<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Validate member session
$sessionId = isset($_GET['session_id']) ? trim($_GET['session_id']) : '';
$memberId  = isset($_GET['member_id']) ? intval($_GET['member_id']) : 0;

if ($sessionId === '' || $memberId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Session and member ID required.']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();

    // Validate session
    $sessionStmt = $db->prepare(
        "SELECT is_active FROM member_sessions 
         WHERE session_id = :session_id AND member_id = :member_id 
         LIMIT 1"
    );
    $sessionStmt->bindParam(':session_id', $sessionId);
    $sessionStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $sessionStmt->execute();
    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$session || !(bool)$session['is_active']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Session is invalid or expired.']);
        exit();
    }

    // Get all accepted family members of this member
    // Then filter to those 12 years old and below
    $familyStmt = $db->prepare(
        "SELECT 
            m.id,
            m.first_name,
            m.surname,
            m.birthday,
            m.qr_token,
            fr.relationship_type
         FROM family_relationships fr
         JOIN members m ON (
             CASE 
                 WHEN fr.member_id = :member_id THEN m.id = fr.relative_id
                 ELSE m.id = fr.member_id
             END
         )
         WHERE (fr.member_id = :member_id OR fr.relative_id = :member_id)
           AND fr.status = 'accepted'
           AND m.id != :member_id
           AND m.birthday IS NOT NULL
           AND TIMESTAMPDIFF(YEAR, m.birthday, CURDATE()) <= 12
           AND m.status IN ('active', 'inactive', 'pending')"
    );
    $familyStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $familyStmt->execute();
    $children = $familyStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($children)) {
        http_response_code(200);
        echo json_encode(['success' => true, 'children' => []]);
        exit();
    }

    // For each child without a qr_token, generate one
    $result = [];
    foreach ($children as $child) {
        $token = $child['qr_token'];

        if (empty($token)) {
            $newToken = bin2hex(random_bytes(32));
            $updateStmt = $db->prepare(
                "UPDATE members SET qr_token = :qr_token WHERE id = :id"
            );
            $updateStmt->bindParam(':qr_token', $newToken);
            $updateStmt->bindParam(':id', $child['id'], PDO::PARAM_INT);
            $updateStmt->execute();
            $token = $newToken;
        }

        $age = null;
        if (!empty($child['birthday'])) {
            $birthDate = new DateTime($child['birthday']);
            $today     = new DateTime();
            $age       = (int)$today->diff($birthDate)->y;
        }

        $result[] = [
            'member_id'         => $child['id'],
            'name'              => trim($child['first_name'] . ' ' . $child['surname']),
            'age'               => $age,
            'birthday'          => $child['birthday'],
            'qr_token'          => $token,
            'relationship_type' => $child['relationship_type'] ?? null
        ];
    }

    http_response_code(200);
    echo json_encode(['success' => true, 'children' => $result]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

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

    // Get member's current qr_token
    $memberStmt = $db->prepare(
        "SELECT id, qr_token, first_name, surname FROM members 
         WHERE id = :id AND status IN ('active', 'inactive', 'pending') 
         LIMIT 1"
    );
    $memberStmt->bindParam(':id', $memberId, PDO::PARAM_INT);
    $memberStmt->execute();
    $member = $memberStmt->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Member not found.']);
        exit();
    }

    // Generate token if not yet set
    if (empty($member['qr_token'])) {
        $newToken = bin2hex(random_bytes(32));

        $updateStmt = $db->prepare(
            "UPDATE members SET qr_token = :qr_token WHERE id = :id"
        );
        $updateStmt->bindParam(':qr_token', $newToken);
        $updateStmt->bindParam(':id', $memberId, PDO::PARAM_INT);
        $updateStmt->execute();

        $member['qr_token'] = $newToken;
    }

    http_response_code(200);
    echo json_encode([
        'success'   => true,
        'qr_token'  => $member['qr_token'],
        'member_id' => $member['id'],
        'name'      => trim($member['first_name'] . ' ' . $member['surname'])
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

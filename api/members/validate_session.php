<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$input = json_decode(file_get_contents("php://input"));
$sessionId = isset($input->sessionId) ? trim($input->sessionId) : '';
$memberId  = isset($input->memberId)  ? (int)$input->memberId  : 0;

if ($sessionId === '' || $memberId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Session ID and Member ID are required.']);
    exit();
}

try {
    $stmt = $db->prepare("SELECT is_active FROM member_sessions WHERE session_id = :session_id AND member_id = :member_id LIMIT 1");
    $stmt->bindParam(':session_id', $sessionId);
    $stmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $stmt->execute();

    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if ((bool)$row['is_active']) {
            // Update last activity
            $update = $db->prepare("UPDATE member_sessions SET last_activity = NOW() WHERE session_id = :session_id");
            $update->bindParam(':session_id', $sessionId);
            $update->execute();
        }
        echo json_encode(['success' => true, 'active' => (bool)$row['is_active']]);
    } else {
        echo json_encode(['success' => true, 'active' => false]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>

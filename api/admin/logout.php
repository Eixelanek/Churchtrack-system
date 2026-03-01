<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$input = json_decode(file_get_contents("php://input"));
$adminId = isset($input->admin_id) ? (int)$input->admin_id : 0;
$sessionId = isset($input->session_id) ? trim($input->session_id) : '';

if ($adminId <= 0 || $sessionId === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Admin ID and session ID are required.'
    ]);
    exit();
}

try {
    $updateSession = $db->prepare("UPDATE admin_sessions SET is_active = 0, last_activity = NOW() WHERE session_id = :session_id AND admin_id = :admin_id");
    $updateSession->bindParam(':session_id', $sessionId);
    $updateSession->bindParam(':admin_id', $adminId, PDO::PARAM_INT);
    $sessionUpdated = $updateSession->execute();

    $updateHistory = $db->prepare("UPDATE login_history SET is_current = 0 WHERE admin_id = :admin_id AND is_current = 1");
    $updateHistory->bindParam(':admin_id', $adminId, PDO::PARAM_INT);
    $updateHistory->execute();

    if ($sessionUpdated) {
        echo json_encode([
            'success' => true,
            'message' => 'Logged out successfully.'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to log out.'
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

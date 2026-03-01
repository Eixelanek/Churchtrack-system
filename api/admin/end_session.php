<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$input = json_decode(file_get_contents("php://input"));
$sessionId = isset($input->sessionId) ? trim($input->sessionId) : '';
$adminId = isset($input->adminId) ? (int)$input->adminId : 0;

if ($sessionId === '' || $adminId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Session ID and Admin ID are required.'
    ]);
    exit();
}

try {
    $query = "UPDATE admin_sessions
              SET is_active = 0, last_activity = NOW()
              WHERE session_id = :session_id AND admin_id = :admin_id";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':session_id', $sessionId);
    $stmt->bindParam(':admin_id', $adminId, PDO::PARAM_INT);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Session ended successfully.'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to end session.'
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

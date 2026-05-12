<?php
// Delete contact message
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $payload = json_decode(file_get_contents('php://input'), true);

    if (!isset($payload['message_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Message ID is required']);
        exit();
    }

    $messageId = (int)$payload['message_id'];

    $deleteQuery = $db->prepare("DELETE FROM contact_messages WHERE id = :id");
    $deleteQuery->bindParam(':id', $messageId, PDO::PARAM_INT);
    $deleteQuery->execute();

    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Message deleted']);

} catch (Exception $e) {
    error_log('Delete message error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

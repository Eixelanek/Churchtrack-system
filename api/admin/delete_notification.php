<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->notification_id)) {
    $query = "DELETE FROM notifications WHERE id = :notification_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(":notification_id", $data->notification_id);
    
    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "message" => "Notification deleted successfully.",
            "status" => "success"
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            "message" => "Unable to delete notification.",
            "status" => "error"
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode([
        "message" => "Notification ID is required.",
        "status" => "error"
    ]);
}
?>

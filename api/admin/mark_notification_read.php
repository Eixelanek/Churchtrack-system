<?php
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Ensure notification_reads table exists
try {
    $checkTable = "SHOW TABLES LIKE 'notification_reads'";
    $stmt = $db->query($checkTable);
    
    if ($stmt->rowCount() == 0) {
        $createTable = "CREATE TABLE IF NOT EXISTS `notification_reads` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `notification_id` int(11) NOT NULL,
          `user_id` int(11) NOT NULL,
          `user_type` varchar(20) NOT NULL,
          `read_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `unique_notification_user` (`notification_id`, `user_id`, `user_type`),
          KEY `notification_id` (`notification_id`),
          KEY `user_id` (`user_id`),
          KEY `user_type` (`user_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        
        $db->exec($createTable);
    }
} catch (Exception $e) {
    error_log("Error checking/creating notification_reads table: " . $e->getMessage());
}

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->notification_id) && !empty($data->user_id) && !empty($data->user_type)) {
    // Insert into notification_reads table (per-user tracking)
    $query = "INSERT INTO notification_reads (notification_id, user_id, user_type) 
              VALUES (:notification_id, :user_id, :user_type)
              ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP";
    $stmt = $db->prepare($query);
    $stmt->bindParam(":notification_id", $data->notification_id);
    $stmt->bindParam(":user_id", $data->user_id);
    $stmt->bindParam(":user_type", $data->user_type);
    
    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "message" => "Notification marked as read successfully.",
            "status" => "success"
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            "message" => "Unable to mark notification as read.",
            "status" => "error"
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode([
        "message" => "Notification ID, user ID, and user type are required.",
        "status" => "error"
    ]);
}
?> 
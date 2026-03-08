<?php
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
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
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to ensure notification reads table exists: ' . $e->getMessage()
    ]);
    exit();
}

$payload = json_decode(file_get_contents('php://input'), true);

$userId = isset($payload['user_id']) ? (int)$payload['user_id'] : 0;
$userType = isset($payload['user_type']) ? trim($payload['user_type']) : '';

if ($userId <= 0 || $userType === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Valid user_id and user_type are required.'
    ]);
    exit();
}

try {
    $query = "INSERT INTO notification_reads (notification_id, user_id, user_type)
              SELECT n.id, :user_id, :user_type
              FROM notifications n
              LEFT JOIN notification_reads nr 
                ON n.id = nr.notification_id 
               AND nr.user_id = :user_id
               AND nr.user_type = :user_type
              WHERE nr.id IS NULL";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindParam(':user_type', $userType, PDO::PARAM_STR);
    $stmt->execute();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'updated' => $stmt->rowCount()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

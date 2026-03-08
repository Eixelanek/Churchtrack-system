<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Delete duplicate notifications, keeping only the most recent one per type/member/event per day
    $query = "DELETE n1 FROM notifications n1
              INNER JOIN notifications n2 
              WHERE n1.id < n2.id 
              AND n1.type = n2.type 
              AND n1.member_id = n2.member_id 
              AND n1.event_id = n2.event_id 
              AND DATE(n1.created_at) = DATE(n2.created_at)
              AND DATE(n1.created_at) = CURDATE()";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $deleted_count = $stmt->rowCount();
    
    echo json_encode([
        "message" => "Cleaned up {$deleted_count} duplicate notifications.",
        "status" => "success"
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        "message" => "Error cleaning up duplicates: " . $e->getMessage(),
        "status" => "error"
    ]);
}
?> 
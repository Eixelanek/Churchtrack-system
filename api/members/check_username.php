<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

if (!isset($_GET['username'])) {
    echo json_encode(['available' => false, 'message' => 'No username provided']);
    exit;
}

$username = $_GET['username'];

$database = new Database();
$db = $database->getConnection();

$query = "SELECT id FROM members WHERE username = :username AND status != 'rejected' LIMIT 1";
$stmt = $db->prepare($query);
$stmt->bindParam(':username', $username);
$stmt->execute();

if ($stmt->rowCount() > 0) {
    echo json_encode(['available' => false, 'message' => 'Username is already taken']);
} else {
    echo json_encode(['available' => true, 'message' => 'Username is available']);
}
?> 
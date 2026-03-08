<?php
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
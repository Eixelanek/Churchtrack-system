<?php
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

if (!isset($_GET['email'])) {
    echo json_encode(['available' => false, 'message' => 'No email provided']);
    exit;
}

$email = $_GET['email'];

$database = new Database();
$db = $database->getConnection();

$query = "SELECT id FROM members WHERE email = :email AND status != 'rejected' LIMIT 1";
$stmt = $db->prepare($query);
$stmt->bindParam(':email', $email);
$stmt->execute();

if ($stmt->rowCount() > 0) {
    echo json_encode(['available' => false, 'message' => 'Email is already taken']);
} else {
    echo json_encode(['available' => true, 'message' => 'Email is available']);
}
?> 
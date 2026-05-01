<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

if (!isset($_GET['username'])) {
    echo json_encode(['available' => false, 'message' => 'No username provided']);
    exit;
}

$username = $_GET['username'];
$exceptId = isset($_GET['except_id']) ? (int) $_GET['except_id'] : 0;

$database = new Database();
$db = $database->getConnection();

$query = "SELECT id FROM members WHERE username = :username AND status != 'rejected'";
if ($exceptId > 0) {
    $query .= " AND id != :except_id";
}
$query .= " LIMIT 1";
$stmt = $db->prepare($query);
$stmt->bindParam(':username', $username);
if ($exceptId > 0) {
    $stmt->bindValue(':except_id', $exceptId, PDO::PARAM_INT);
}
$stmt->execute();

if ($stmt->rowCount() > 0) {
    echo json_encode(['available' => false, 'message' => 'Username is already taken']);
} else {
    echo json_encode(['available' => true, 'message' => 'Username is available']);
}
?> 
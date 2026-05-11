<?php

// Add CORS headers for cross-origin requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    $database = new Database();
    $db = $database->getConnection();

    $query = "DELETE FROM members WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(":id", $data->id);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "Member deleted successfully."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to delete member."]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "No member ID provided."]);
}
?>
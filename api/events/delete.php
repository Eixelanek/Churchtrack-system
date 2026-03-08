<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $data = json_decode(file_get_contents("php://input"));

    if (!empty($data->id)) {
        $id = $data->id;

        // Check if event exists
        $check_query = "SELECT id FROM events WHERE id = :id";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":id", $id);
        $check_stmt->execute();

        if ($check_stmt->rowCount() == 0) {
            http_response_code(404);
            echo json_encode(["message" => "Event not found."]);
            exit();
        }

        // Delete the event (attendance records will be deleted automatically due to CASCADE)
        $query = "DELETE FROM events WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":id", $id);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(["message" => "Event deleted successfully."]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Unable to delete event."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Event ID is required."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
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

    if (!empty($data->event_id)) {
        $event_id = $data->event_id;
        $linked_event_id = $data->linked_event_id ?? null;

        // Check if event exists
        $check_query = "SELECT id FROM events WHERE id = :event_id";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":event_id", $event_id);
        $check_stmt->execute();

        if ($check_stmt->rowCount() == 0) {
            http_response_code(404);
            echo json_encode(["message" => "Event not found."]);
            exit();
        }

        // If linked_event_id is provided, unlink specific event
        if (!empty($linked_event_id)) {
            // Check if linked event exists
            $check_linked_query = "SELECT id FROM events WHERE id = :linked_event_id";
            $check_linked_stmt = $db->prepare($check_linked_query);
            $check_linked_stmt->bindParam(":linked_event_id", $linked_event_id);
            $check_linked_stmt->execute();

            if ($check_linked_stmt->rowCount() == 0) {
                http_response_code(404);
                echo json_encode(["message" => "Linked event not found."]);
                exit();
            }

            // Delete specific link between these two events
            $delete_query = "DELETE FROM linked_events WHERE 
                           (event_id_1 = :event_id AND event_id_2 = :linked_event_id) OR 
                           (event_id_1 = :linked_event_id AND event_id_2 = :event_id)";
            $delete_stmt = $db->prepare($delete_query);
            $delete_stmt->bindParam(":event_id", $event_id);
            $delete_stmt->bindParam(":linked_event_id", $linked_event_id);
        } else {
            // Delete all links involving this event
            $delete_query = "DELETE FROM linked_events WHERE event_id_1 = :event_id OR event_id_2 = :event_id";
            $delete_stmt = $db->prepare($delete_query);
            $delete_stmt->bindParam(":event_id", $event_id);
        }

        if ($delete_stmt->execute()) {
            $affected_rows = $delete_stmt->rowCount();
            
            // If unlinking specific events, simply remove the link - no attendance separation needed
            // Each event keeps its own independent attendance records
            // This is the simpler approach for church events
            
            http_response_code(200);
            echo json_encode([
                "message" => "Event unlinked successfully.",
                "unlinked_relationships" => $affected_rows
            ]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Unable to unlink event."]);
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
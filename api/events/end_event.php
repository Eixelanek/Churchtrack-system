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
        $check_query = "SELECT id, status FROM events WHERE id = :id";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":id", $id);
        $check_stmt->execute();

        if ($check_stmt->rowCount() == 0) {
            http_response_code(404);
            echo json_encode(["message" => "Event not found."]);
            exit();
        }

        $event = $check_stmt->fetch(PDO::FETCH_ASSOC);
        if ($event['status'] === 'completed') {
            http_response_code(400);
            echo json_encode(["message" => "Event is already completed."]);
            exit();
        }

        // Start transaction
        $db->beginTransaction();

        try {
            // Check if this is an auto-end or manual end
            $isAutoEnded = isset($data->autoEnded) ? $data->autoEnded : false;
            
            // End the event
            $query = "UPDATE events SET status = 'completed', manually_ended = :manually_ended, auto_ended = :auto_ended WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":id", $id);
            $stmt->bindParam(":manually_ended", !$isAutoEnded, PDO::PARAM_BOOL);
            $stmt->bindParam(":auto_ended", $isAutoEnded, PDO::PARAM_BOOL);

            if ($stmt->execute()) {
                                 // Mark all active members who existed when the event ended and didn't attend as absent
                 // Use current timestamp to include all members who existed when the event was completed
                 $mark_absent_query = "INSERT INTO attendance (event_id, member_id, status, check_in_time) 
                                      SELECT :event_id, m.id, 'absent', NOW()
                                      FROM members m 
                                      WHERE m.status = 'active' 
                                      AND m.created_at <= NOW()
                                      AND m.id NOT IN (
                                          SELECT a.member_id 
                                          FROM attendance a 
                                          WHERE a.event_id = :event_id
                                      )";
                 
                 $mark_absent_stmt = $db->prepare($mark_absent_query);
                 $mark_absent_stmt->bindParam(":event_id", $id);
                $mark_absent_stmt->execute();

                // Commit transaction
                $db->commit();

                http_response_code(200);
                echo json_encode(["message" => "Event ended successfully."]);
            } else {
                $db->rollback();
                http_response_code(503);
                echo json_encode(["message" => "Unable to end event."]);
            }
        } catch (Exception $e) {
            $db->rollback();
            throw $e;
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
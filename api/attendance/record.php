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

    if (!empty($data->event_id) && !empty($data->attendance_data) && is_array($data->attendance_data)) {
        $event_id = $data->event_id;
        $attendance_data = $data->attendance_data;

        // Check if event exists and is active/upcoming
        $event_query = "SELECT id, status, date FROM events WHERE id = :event_id";
        $event_stmt = $db->prepare($event_query);
        $event_stmt->bindParam(":event_id", $event_id);
        $event_stmt->execute();

        if ($event_stmt->rowCount() == 0) {
            http_response_code(404);
            echo json_encode(["message" => "Event not found."]);
            exit();
        }

        $event = $event_stmt->fetch(PDO::FETCH_ASSOC);
        if ($event['status'] === 'completed') {
            http_response_code(400);
            echo json_encode(["message" => "Cannot record attendance for completed events."]);
            exit();
        }

        // Get linked events
        $linked_events_query = "SELECT 
                                CASE 
                                    WHEN event_id_1 = :event_id THEN event_id_2 
                                    ELSE event_id_1 
                                END as linked_event_id
                               FROM linked_events 
                               WHERE event_id_1 = :event_id OR event_id_2 = :event_id";
        $linked_events_stmt = $db->prepare($linked_events_query);
        $linked_events_stmt->bindParam(":event_id", $event_id);
        $linked_events_stmt->execute();

        $linked_event_ids = [];
        while ($linked_event = $linked_events_stmt->fetch(PDO::FETCH_ASSOC)) {
            $linked_event_ids[] = $linked_event['linked_event_id'];
        }

        // Start transaction
        $db->beginTransaction();

        try {
            $success_count = 0;
            $errors = [];

            foreach ($attendance_data as $attendance) {
                if (!empty($attendance->member_id)) {
                    $member_id = $attendance->member_id;
                    $status = $attendance->status;
                    $check_in_time = $attendance->check_in_time;

                    // If status is null, remove the attendance record
                    if ($status === null) {
                        $delete_query = "DELETE FROM attendance WHERE event_id = :event_id AND member_id = :member_id";
                        $delete_stmt = $db->prepare($delete_query);
                        $delete_stmt->bindParam(":event_id", $event_id);
                        $delete_stmt->bindParam(":member_id", $member_id);
                        
                        if ($delete_stmt->execute()) {
                            $success_count++;
                            
                            // Also remove from linked events
                            foreach ($linked_event_ids as $linked_event_id) {
                                $linked_delete_query = "DELETE FROM attendance WHERE event_id = :event_id AND member_id = :member_id";
                                $linked_delete_stmt = $db->prepare($linked_delete_query);
                                $linked_delete_stmt->bindParam(":event_id", $linked_event_id);
                                $linked_delete_stmt->bindParam(":member_id", $member_id);
                                $linked_delete_stmt->execute();
                            }
                        }
                        continue;
                    }

                    // Validate status for non-null values
                    if (!in_array(strtolower($status), ['present', 'late'])) {
                        $errors[] = "Invalid status for member ID $member_id";
                        continue;
                    }
                    
                    $status = strtolower($status);

                    // Check if member exists and is active
                    $member_query = "SELECT id FROM members WHERE id = :member_id AND status = 'active'";
                    $member_stmt = $db->prepare($member_query);
                    $member_stmt->bindParam(":member_id", $member_id);
                    $member_stmt->execute();

                    if ($member_stmt->rowCount() == 0) {
                        $errors[] = "Member ID $member_id not found or not active";
                        continue;
                    }

                    // Insert attendance for main event
                    $insert_query = "INSERT INTO attendance (event_id, member_id, status, check_in_time) 
                                   VALUES (:event_id, :member_id, :status, :check_in_time)
                                   ON DUPLICATE KEY UPDATE 
                                   status = :status, 
                                   check_in_time = :check_in_time";
                    
                    $insert_stmt = $db->prepare($insert_query);
                    $insert_stmt->bindParam(":event_id", $event_id);
                    $insert_stmt->bindParam(":member_id", $member_id);
                    $insert_stmt->bindParam(":status", $status);
                    $insert_stmt->bindParam(":check_in_time", $check_in_time);

                    if ($insert_stmt->execute()) {
                        $success_count++;

                        // For church events: DO NOT synchronize attendance between linked events
                        // Each event maintains its own independent attendance records
                        // This allows Event 1 (8-10 AM) and Event 2 (10-12 PM) to have separate attendance
                    } else {
                        $errors[] = "Failed to record attendance for member ID $member_id";
                    }
                } else {
                    $errors[] = "Incomplete attendance data";
                }
            }

            // Commit transaction
            $db->commit();

            $response = [
                "message" => "Attendance recorded successfully.",
                "success_count" => $success_count,
                "total_records" => count($attendance_data)
            ];

            if (!empty($errors)) {
                $response["errors"] = $errors;
            }

            http_response_code(200);
            echo json_encode($response);

        } catch (Exception $e) {
            // Rollback transaction on error
            $db->rollback();
            throw $e;
        }

    } else {
        http_response_code(400);
        echo json_encode(["message" => "Event ID and attendance data array are required."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
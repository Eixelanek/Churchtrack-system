<?php
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $event_id = $_GET['event_id'] ?? null;

        if (empty($event_id)) {
            http_response_code(400);
            echo json_encode(["message" => "Event ID is required."]);
            exit();
        }

        // Get all linked event IDs
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

        $linked_event_ids = [$event_id]; // Include the main event
        while ($linked_event = $linked_events_stmt->fetch(PDO::FETCH_ASSOC)) {
            $linked_event_ids[] = $linked_event['linked_event_id'];
        }

        // Get merged attendance data from all linked events
        $placeholders = str_repeat('?,', count($linked_event_ids) - 1) . '?';
        $attendance_query = "SELECT DISTINCT 
                                a.member_id,
                                m.full_name AS name,
                                m.email,
                                m.profile_picture,
                                a.status,
                                a.check_in_time,
                                a.event_id,
                                e.title as event_title
                            FROM attendance a
                            JOIN members m ON a.member_id = m.id
                            JOIN events e ON a.event_id = e.id
                            WHERE a.event_id IN ($placeholders)
                            AND m.status = 'active'
                            ORDER BY a.check_in_time ASC";

        $attendance_stmt = $db->prepare($attendance_query);
        $attendance_stmt->execute($linked_event_ids);

        $merged_attendance = [];
        while ($row = $attendance_stmt->fetch(PDO::FETCH_ASSOC)) {
            $member_id = $row['member_id'];
            
            // If member already exists, keep the earliest check-in time
            if (isset($merged_attendance[$member_id])) {
                $existing_time = strtotime($merged_attendance[$member_id]['check_in_time']);
                $new_time = strtotime($row['check_in_time']);
                
                if ($new_time < $existing_time) {
                    $merged_attendance[$member_id] = $row;
                }
            } else {
                $merged_attendance[$member_id] = $row;
            }
        }

        // Convert to array format and format time
        $result = array_values($merged_attendance);
        
        // Format check_in_time to show only hours and minutes
        foreach ($result as &$attendee) {
            if ($attendee['check_in_time']) {
                $attendee['check_in_time'] = date('H:i', strtotime($attendee['check_in_time']));
            }
        }

        http_response_code(200);
        echo json_encode($result);

    } else {
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
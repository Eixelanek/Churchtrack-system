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

    $data = json_decode(file_get_contents("php://input"));

    if (!empty($data->id) && !empty($data->title) && !empty($data->date) && !empty($data->start_time) && !empty($data->end_time) && !empty($data->location)) {
        $id = $data->id;
        $title = htmlspecialchars(strip_tags($data->title));
        $date = htmlspecialchars(strip_tags($data->date));
        $start_time = htmlspecialchars(strip_tags($data->start_time));
        $end_time = htmlspecialchars(strip_tags($data->end_time));
        $location = htmlspecialchars(strip_tags($data->location));

        // Validate that end time is after start time
        if ($start_time >= $end_time) {
            http_response_code(400);
            echo json_encode(["message" => "End time must be after start time."]);
            exit();
        }

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

        $query = "UPDATE events SET title = :title, date = :date, start_time = :start_time, end_time = :end_time, location = :location WHERE id = :id";
        $stmt = $db->prepare($query);
        
        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":title", $title);
        $stmt->bindParam(":date", $date);
        $stmt->bindParam(":start_time", $start_time);
        $stmt->bindParam(":end_time", $end_time);
        $stmt->bindParam(":location", $location);

        if ($stmt->execute()) {
            // Delete old notifications for this event (to allow new notifications for the new time)
            $delete_notifications_query = "DELETE FROM notifications 
                                          WHERE event_id = :event_id 
                                          AND type = 'event_reminder' 
                                          AND DATE(created_at) = CURDATE()";
            $delete_stmt = $db->prepare($delete_notifications_query);
            $delete_stmt->bindParam(":event_id", $id);
            $delete_stmt->execute();
            
            http_response_code(200);
            echo json_encode([
                "message" => "Event updated successfully.",
                "id" => $id,
                "title" => $title,
                "date" => $date,
                "start_time" => $start_time,
                "end_time" => $end_time,
                "location" => $location
            ]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Unable to update event."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Incomplete data. ID, title, date, start_time, end_time, and location are required."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
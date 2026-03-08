<?php
// Add CORS headers for cross-origin requests
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

    if (!empty($data->title) && !empty($data->date) && !empty($data->start_time) && !empty($data->end_time) && !empty($data->location)) {
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

        $query = "INSERT INTO events (title, date, start_time, end_time, location, status) VALUES (:title, :date, :start_time, :end_time, :location, 'upcoming')";
        $stmt = $db->prepare($query);
        
        $stmt->bindParam(":title", $title);
        $stmt->bindParam(":date", $date);
        $stmt->bindParam(":start_time", $start_time);
        $stmt->bindParam(":end_time", $end_time);
        $stmt->bindParam(":location", $location);

        if ($stmt->execute()) {
            $event_id = $db->lastInsertId();
            http_response_code(201);
            echo json_encode([
                "message" => "Event created successfully.",
                "id" => $event_id,
                "title" => $title,
                "date" => $date,
                "start_time" => $start_time,
                "end_time" => $end_time,
                "location" => $location,
                "status" => "upcoming"
            ]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Unable to create event."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Incomplete data. Title, date, start_time, end_time, and location are required."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
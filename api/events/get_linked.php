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

    $event_id = $_GET['event_id'] ?? null;

    if (!$event_id) {
        http_response_code(400);
        echo json_encode(["message" => "Event ID is required."]);
        exit();
    }

    // Get linked events
    $query = "SELECT 
                CASE 
                    WHEN le.event_id_1 = :event_id THEN le.event_id_2 
                    ELSE le.event_id_1 
                END as linked_event_id,
                e.title,
                e.date,
                e.start_time,
                e.end_time,
                e.location,
                e.status
              FROM linked_events le
              JOIN events e ON (
                  CASE 
                      WHEN le.event_id_1 = :event_id THEN le.event_id_2 
                      ELSE le.event_id_1 
                  END = e.id
              )
              WHERE le.event_id_1 = :event_id OR le.event_id_2 = :event_id";

    $stmt = $db->prepare($query);
    $stmt->bindParam(":event_id", $event_id);
    $stmt->execute();

    $linked_events = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Format times for frontend compatibility
        $start_time_12hr = date('g:i A', strtotime($row['start_time']));
        $end_time_12hr = date('g:i A', strtotime($row['end_time']));

        $linked_events[] = [
            'id' => $row['linked_event_id'],
            'title' => $row['title'],
            'date' => $row['date'],
            'time' => $start_time_12hr,
            'endTime' => $end_time_12hr,
            'location' => $row['location'],
            'status' => $row['status']
        ];
    }

    http_response_code(200);
    echo json_encode($linked_events);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
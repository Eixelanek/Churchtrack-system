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

    if (!empty($data->event_id_1) && !empty($data->event_id_2)) {
        $event_id_1 = $data->event_id_1;
        $event_id_2 = $data->event_id_2;

        // Ensure event_id_1 is always the smaller ID
        if ($event_id_1 > $event_id_2) {
            $temp = $event_id_1;
            $event_id_1 = $event_id_2;
            $event_id_2 = $temp;
        }

        // Check if both events exist and are on the same day
        $events_query = "SELECT id, date FROM events WHERE id IN (:event_id_1, :event_id_2)";
        $events_stmt = $db->prepare($events_query);
        $events_stmt->bindParam(":event_id_1", $event_id_1);
        $events_stmt->bindParam(":event_id_2", $event_id_2);
        $events_stmt->execute();

        if ($events_stmt->rowCount() != 2) {
            http_response_code(404);
            echo json_encode(["message" => "One or both events not found."]);
            exit();
        }

        $events = $events_stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($events[0]['date'] !== $events[1]['date']) {
            http_response_code(400);
            echo json_encode(["message" => "Events must be on the same day to be linked."]);
            exit();
        }

        // Check if link already exists
        $check_query = "SELECT id FROM linked_events WHERE event_id_1 = :event_id_1 AND event_id_2 = :event_id_2";
        $check_stmt = $db->prepare($check_query);
        $check_stmt->bindParam(":event_id_1", $event_id_1);
        $check_stmt->bindParam(":event_id_2", $event_id_2);
        $check_stmt->execute();

        if ($check_stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(["message" => "Events are already linked."]);
            exit();
        }

        // Create the link
        $insert_query = "INSERT INTO linked_events (event_id_1, event_id_2) VALUES (:event_id_1, :event_id_2)";
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->bindParam(":event_id_1", $event_id_1);
        $insert_stmt->bindParam(":event_id_2", $event_id_2);

        if ($insert_stmt->execute()) {
            http_response_code(201);
            echo json_encode([
                "message" => "Events linked successfully.",
                "event_id_1" => $event_id_1,
                "event_id_2" => $event_id_2
            ]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Unable to link events."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Both event IDs are required."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 
<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $limit = isset($_GET['limit']) ? min(10, max(1, (int)$_GET['limit'])) : 5;
    $today = date('Y-m-d');
    $now   = date('Y-m-d H:i:s');

    // Auto-activate events whose start time has arrived
    $db->exec("UPDATE events
               SET status = 'active', updated_at = NOW()
               WHERE status = 'upcoming'
                 AND CONCAT(date, ' ', start_time) <= NOW()");

    // Fetch upcoming events (status = 'upcoming' and date >= today)
    $query = "SELECT id, title, date, start_time, end_time, location, status
              FROM events
              WHERE status = 'upcoming'
                AND date >= :today
              ORDER BY date ASC, start_time ASC
              LIMIT :lim";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':today', $today);
    $stmt->bindParam(':lim',   $limit, PDO::PARAM_INT);
    $stmt->execute();

    $events = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $events[] = [
            'id'       => (int)$row['id'],
            'title'    => $row['title'],
            'date'     => $row['date'],
            'time'     => date('g:i A', strtotime($row['start_time'])),
            'endTime'  => date('g:i A', strtotime($row['end_time'])),
            'location' => $row['location'],
            'status'   => $row['status']
        ];
    }

    echo json_encode(['success' => true, 'data' => $events]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>

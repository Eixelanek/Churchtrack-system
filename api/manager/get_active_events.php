<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Validate manager session (uses admin_sessions table with role = 'manager')
$sessionId = isset($_GET['session_id']) ? trim($_GET['session_id']) : '';
$managerId = isset($_GET['manager_id']) ? intval($_GET['manager_id']) : 0;

if ($sessionId === '' || $managerId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Session and manager ID required.']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();

    // Validate manager session
    $sessionStmt = $db->prepare(
        "SELECT is_active FROM admin_sessions 
         WHERE session_id = :session_id AND admin_id = :admin_id 
         LIMIT 1"
    );
    $sessionStmt->bindParam(':session_id', $sessionId);
    $sessionStmt->bindParam(':admin_id', $managerId, PDO::PARAM_INT);
    $sessionStmt->execute();
    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$session || !(bool)$session['is_active']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Session is invalid or expired.']);
        exit();
    }

    // Auto-activate upcoming events whose start time has arrived
    $db->exec("UPDATE events SET status = 'active', updated_at = NOW()
               WHERE status = 'upcoming' AND CONCAT(date, ' ', start_time) <= NOW()");

    // Auto-complete events whose end_time has passed
    $db->exec("UPDATE events SET status = 'completed', auto_ended = 1, manually_ended = 0, updated_at = NOW()
               WHERE status != 'completed' 
                 AND (
                   CONCAT(date, ' ', end_time) <= NOW()
                   OR date < CURDATE()
                 )");

    // Get scannable events — active OR upcoming, today or within next 24 hours
    $eventsStmt = $db->prepare(
        "SELECT 
            id,
            title,
            event_type,
            date,
            start_time,
            end_time,
            location,
            status,
            (SELECT COUNT(*) FROM attendance a WHERE a.event_id = events.id AND a.status IN ('present','late')) AS attendee_count
         FROM events
         WHERE status IN ('active', 'upcoming')
           AND date >= CURDATE()
           AND date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         ORDER BY date ASC, start_time ASC"
    );
    $eventsStmt->execute();
    $events = $eventsStmt->fetchAll(PDO::FETCH_ASSOC);

    // If no events found within 24 hours, also return any active/upcoming event from today
    if (empty($events)) {
        $todayStmt = $db->prepare(
            "SELECT 
                id,
                title,
                event_type,
                date,
                start_time,
                end_time,
                location,
                status,
                (SELECT COUNT(*) FROM attendance a WHERE a.event_id = events.id AND a.status IN ('present','late')) AS attendee_count
             FROM events
             WHERE status IN ('active', 'upcoming')
               AND date = CURDATE()
             ORDER BY start_time ASC"
        );
        $todayStmt->execute();
        $events = $todayStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Format times
    foreach ($events as &$event) {
        $event['id']            = (int)$event['id'];
        $event['attendee_count'] = (int)$event['attendee_count'];

        // Build a readable label for the frontend
        $dateLabel = $event['date']
            ? (new DateTime($event['date']))->format('M j, Y')
            : '';
        $timeLabel = $event['start_time']
            ? (new DateTime($event['start_time']))->format('g:i A')
            : '';
        $event['label'] = trim($event['title'] . ' — ' . $dateLabel . ($timeLabel ? ' at ' . $timeLabel : ''));
    }
    unset($event);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'events'  => $events
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

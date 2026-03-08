<?php
// Add CORS headers for cross-origin requests
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    $allowedStatuses = ['active', 'completed', 'cancelled'];
    $status = isset($_GET['status']) ? strtolower(trim($_GET['status'])) : 'completed';

    $whereClauses = [];
    $params = [];

    if ($status === 'all') {
        $whereClauses[] = "e.status IN ('active', 'completed')";
    } elseif (in_array($status, $allowedStatuses, true)) {
        $whereClauses[] = "e.status = :status";
        $params[':status'] = $status;
    } else {
        $whereClauses[] = "e.status = 'completed'";
    }

    $whereSql = '';
    if (!empty($whereClauses)) {
        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
    }

    $query = "SELECT 
                e.id,
                e.title,
                e.event_type,
                e.date,
                e.start_time,
                e.end_time,
                e.location,
                e.status,
                COALESCE(manual.manual_attendees, 0) + COALESCE(qr.qr_attendees, 0) + COALESCE(guests.guest_count, 0) AS total_attendees,
                COALESCE(manual.manual_attendees, 0) AS manual_attendees,
                COALESCE(qr.qr_attendees, 0) AS qr_attendees,
                COALESCE(guests.guest_count, 0) AS guest_attendees
              FROM events e
              LEFT JOIN (
                SELECT 
                  event_id,
                  COUNT(DISTINCT CASE WHEN LOWER(status) IN ('present', 'late') AND member_id IS NOT NULL THEN member_id END) AS manual_attendees
                FROM attendance
                GROUP BY event_id
              ) manual ON manual.event_id = e.id
              LEFT JOIN (
                SELECT 
                  qs.event_id,
                  COUNT(DISTINCT CASE 
                    WHEN qa.member_id IS NOT NULL THEN CONCAT('m-', qa.member_id)
                    WHEN qa.member_name IS NOT NULL AND TRIM(qa.member_name) <> '' THEN CONCAT('n-', LOWER(TRIM(qa.member_name)))
                    ELSE CONCAT('q-', qa.id)
                  END) AS qr_attendees
                FROM qr_sessions qs
                LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
                GROUP BY qs.event_id
              ) qr ON qr.event_id = e.id
              LEFT JOIN (
                SELECT 
                  COALESCE(ga.event_id, qs.event_id) AS event_id,
                  COUNT(DISTINCT ga.guest_id) AS guest_count
                FROM guest_attendance ga
                LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
                WHERE ga.event_id IS NOT NULL OR qs.event_id IS NOT NULL
                GROUP BY COALESCE(ga.event_id, qs.event_id)
              ) guests ON guests.event_id = e.id
              $whereSql
              ORDER BY e.date DESC, e.start_time DESC";
    
    $stmt = $db->prepare($query);

    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }

    $stmt->execute();
    
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format the response
    $formattedEvents = array_map(function($event) {
        return [
            'id' => (int)$event['id'],
            'title' => $event['title'],
            'type' => $event['event_type'],
            'date' => $event['date'],
            'startTime' => $event['start_time'],
            'endTime' => $event['end_time'],
            'location' => $event['location'],
            'status' => $event['status'],
            'totalAttendees' => (int)$event['total_attendees']
        ];
    }, $events);
    
    echo json_encode([
        'success' => true,
        'events' => $formattedEvents
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

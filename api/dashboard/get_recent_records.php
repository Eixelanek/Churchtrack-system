<?php
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get limit from query parameter (default 5)
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
    
    // Get recent QR attendance sessions with counts
    $query = "SELECT 
                qs.id AS session_id,
                COALESCE(NULLIF(qs.service_name, ''), 'Unnamed Service') AS service_name,
                qs.event_type,
                qs.event_datetime,
                COUNT(DISTINCT qa.member_id) AS attendee_count,
                MAX(qa.checkin_datetime) AS last_updated
              FROM qr_sessions qs
              LEFT JOIN qr_attendance qa ON qa.session_id = qs.id AND qa.member_id IS NOT NULL
              WHERE qs.event_datetime IS NOT NULL
                AND qs.status IN ('completed', 'active', 'expired')
              GROUP BY qs.id
              ORDER BY qs.event_datetime DESC
              LIMIT :limit";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format the records
    $formattedRecords = array_map(function($record) {
        $eventDateTime = !empty($record['event_datetime']) ? new DateTime($record['event_datetime']) : null;
        $formattedDate = $eventDateTime ? $eventDateTime->format('M j, Y') : 'No date';

        // Format time
        $time = '';
        if ($eventDateTime) {
            $time = $eventDateTime->format('g:i A');
        }
        
        return [
            'id' => (int)$record['session_id'],
            'title' => $record['service_name'],
            'type' => $record['event_type'],
            'date' => $formattedDate,
            'event_datetime' => $record['event_datetime'],
            'time' => $time,
            'attendeeCount' => (int)$record['attendee_count'],
            'lastUpdated' => $record['last_updated']
        ];
    }, $records);
    
    echo json_encode([
        'success' => true,
        'records' => $formattedRecords
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

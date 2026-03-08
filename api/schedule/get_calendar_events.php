<?php
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get month and year from query params (default to current month)
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    
    // Get first and last day of the month
    $startDate = date('Y-m-01', strtotime("$year-$month-01"));
    $endDate = date('Y-m-t', strtotime("$year-$month-01"));
    
    // Get QR sessions scheduled for the month
    $query = "SELECT 
                qs.id,
                COALESCE(NULLIF(qs.service_name, ''), 'Unnamed Service') AS title,
                qs.event_type,
                qs.session_type,
                qs.event_datetime,
                qs.status,
                qs.scan_count
              FROM qr_sessions qs
              WHERE DATE(qs.event_datetime) BETWEEN :start_date AND :end_date
              ORDER BY qs.event_datetime ASC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->bindParam(':end_date', $endDate);
    $stmt->execute();
    
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format sessions for calendar
    $calendarEvents = array_map(function($event) {
        $datetime = !empty($event['event_datetime']) ? new DateTime($event['event_datetime']) : null;
        $formattedDate = $datetime ? $datetime->format('Y-m-d') : null;
        $startTime = $datetime ? $datetime->format('g:i A') : null;
        
        $typeLabel = isset($event['event_type']) && $event['event_type']
            ? ucfirst($event['event_type'])
            : 'Session';
        
        return [
            'id' => (int)$event['id'],
            'title' => $event['title'],
            'type' => $typeLabel,
            'date' => $formattedDate,
            'eventDateTime' => $datetime ? $datetime->format('Y-m-d\TH:i:s') : null,
            'startTime' => $startTime,
            'location' => 'QR Session',
            'status' => $event['status'],
            'sessionType' => isset($event['session_type']) ? ucfirst($event['session_type']) : null,
            'scanCount' => isset($event['scan_count']) ? (int)$event['scan_count'] : 0,
            'description' => ''
        ];
    }, $events);
    
    echo json_encode([
        'success' => true,
        'month' => $month,
        'year' => $year,
        'events' => $calendarEvents
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

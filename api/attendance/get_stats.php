<?php
// Add CORS headers for cross-origin requests
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get current week's date range (Sunday to Saturday)
    $today = new DateTime();
    $dayOfWeek = $today->format('w'); // 0 (Sunday) to 6 (Saturday)
    
    // Calculate Sunday of current week
    $sunday = clone $today;
    $sunday->modify('-' . $dayOfWeek . ' days');
    $sunday->setTime(0, 0, 0);
    
    // Calculate Saturday of current week
    $saturday = clone $sunday;
    $saturday->modify('+6 days');
    $saturday->setTime(23, 59, 59);
    
    $startDate = $sunday->format('Y-m-d');
    $endDate = $saturday->format('Y-m-d');
    
    // Get total records this week
    $totalRecordsQuery = "SELECT COUNT(DISTINCT e.id) as total
                          FROM events e
                          WHERE e.date BETWEEN :start_date AND :end_date
                          AND e.status = 'completed'";
    
    $stmt = $db->prepare($totalRecordsQuery);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->bindParam(':end_date', $endDate);
    $stmt->execute();
    $totalRecords = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get average attendance per service
    $avgQuery = "SELECT AVG(attendee_count) as average
                 FROM (
                     SELECT COUNT(DISTINCT a.member_id) as attendee_count
                     FROM events e
                     LEFT JOIN attendance a ON e.id = a.event_id 
                         AND a.status IN ('Present', 'Late')
                     WHERE e.status = 'completed'
                     GROUP BY e.id
                 ) as counts";
    
    $stmt = $db->prepare($avgQuery);
    $stmt->execute();
    $avgResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $averagePerService = $avgResult['average'] ? round($avgResult['average']) : 0;
    
    // Calculate attendance rate
    // (Total attendees across all events / (Total events * Total active members)) * 100
    $rateQuery = "SELECT 
                    COUNT(DISTINCT e.id) as total_events,
                    COUNT(DISTINCT m.id) as total_members,
                    COUNT(DISTINCT CONCAT(a.event_id, '-', a.member_id)) as total_attendance
                  FROM events e
                  CROSS JOIN members m
                  LEFT JOIN attendance a ON e.id = a.event_id 
                      AND m.id = a.member_id 
                      AND a.status IN ('Present', 'Late')
                  WHERE e.status = 'completed'
                  AND m.status = 'Active'";
    
    $stmt = $db->prepare($rateQuery);
    $stmt->execute();
    $rateResult = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $attendanceRate = 0;
    if ($rateResult['total_events'] > 0 && $rateResult['total_members'] > 0) {
        $expectedAttendance = $rateResult['total_events'] * $rateResult['total_members'];
        $attendanceRate = round(($rateResult['total_attendance'] / $expectedAttendance) * 100);
    }
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'totalRecords' => (int)$totalRecords,
            'averagePerService' => (int)$averagePerService,
            'attendanceRate' => (int)$attendanceRate
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

<?php
// Add CORS headers for cross-origin requests
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get total members (exclude rejected)
    $totalMembersQuery = "SELECT COUNT(*) as total FROM members WHERE status IN ('Active', 'Inactive')";
    $stmt = $db->prepare($totalMembersQuery);
    $stmt->execute();
    $totalMembers = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get active members
    $activeMembersQuery = "SELECT COUNT(*) as total FROM members WHERE status = 'Active'";
    $stmt = $db->prepare($activeMembersQuery);
    $stmt->execute();
    $activeMembers = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get today's attendance (from QR check-ins)
    $today = date('Y-m-d');
    $todayAttendanceQuery = "SELECT COUNT(DISTINCT qa.member_id) as total
                             FROM qr_attendance qa
                             INNER JOIN qr_sessions qs ON qa.session_id = qs.id
                             WHERE DATE(qa.checkin_datetime) = :today
                             AND qa.member_id IS NOT NULL";
    $stmt = $db->prepare($todayAttendanceQuery);
    $stmt->bindParam(':today', $today);
    $stmt->execute();
    $todayAttendance = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Calculate today's attendance rate
    $todayRate = 0;
    if ($activeMembers > 0) {
        $todayRate = round(($todayAttendance / $activeMembers) * 100);
    }
    
    // Get current week's date range (Sunday to Saturday)
    $todayDate = new DateTime();
    $dayOfWeek = $todayDate->format('w'); // 0 (Sunday) to 6 (Saturday)
    
    // Calculate Sunday of current week
    $sunday = clone $todayDate;
    $sunday->modify('-' . $dayOfWeek . ' days');
    $sunday->setTime(0, 0, 0);
    
    // Calculate Saturday of current week
    $saturday = clone $sunday;
    $saturday->modify('+6 days');
    $saturday->setTime(23, 59, 59);
    
    $startDate = $sunday->format('Y-m-d');
    $endDate = $saturday->format('Y-m-d');
    
    // Get this week's total attendance (from QR check-ins)
    $weekAttendanceQuery = "SELECT COUNT(DISTINCT CONCAT(qa.session_id, '-', qa.member_id)) as total
                            FROM qr_attendance qa
                            INNER JOIN qr_sessions qs ON qa.session_id = qs.id
                            WHERE DATE(qa.checkin_datetime) BETWEEN :start_date AND :end_date
                            AND qa.member_id IS NOT NULL";
    $stmt = $db->prepare($weekAttendanceQuery);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->bindParam(':end_date', $endDate);
    $stmt->execute();
    $weekAttendance = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get weekly average attendance rate
    $weekEventsQuery = "SELECT COUNT(DISTINCT qs.id) as total_events
                        FROM qr_sessions qs
                        WHERE DATE(qs.event_datetime) BETWEEN :start_date AND :end_date
                        AND qs.status IN ('active', 'expired', 'completed')";
    $stmt = $db->prepare($weekEventsQuery);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->bindParam(':end_date', $endDate);
    $stmt->execute();
    $weekEvents = $stmt->fetch(PDO::FETCH_ASSOC)['total_events'];
    
    $weeklyAttendanceRate = 0;
    if ($weekEvents > 0 && $activeMembers > 0) {
        $expectedWeekAttendance = $weekEvents * $activeMembers;
        $weeklyAttendanceRate = round(($weekAttendance / $expectedWeekAttendance) * 100);
    }
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'totalMembers' => (int)$totalMembers,
            'activeMembers' => (int)$activeMembers,
            'todayAttendance' => (int)$todayAttendance,
            'todayRate' => (int)$todayRate,
            'weekAttendance' => (int)$weekAttendance,
            'weeklyAttendanceRate' => (int)$weeklyAttendanceRate
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

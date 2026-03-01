<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get limit from query parameter (default 5)
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
    
    // Calculate date 30 days ago for recent activity
    $thirtyDaysAgo = date('Y-m-d', strtotime('-30 days'));
    
    // Get top active members based on attendance in the last 30 days
    // Calculate engagement score based on attendance frequency
    $query = "SELECT 
                m.id,
                CONCAT(m.first_name, ' ', 
                       COALESCE(CONCAT(m.middle_name, ' '), ''), 
                       m.surname,
                       CASE WHEN m.suffix != 'None' AND m.suffix != '' THEN CONCAT(' ', m.suffix) ELSE '' END) as name,
                COUNT(DISTINCT DATE(qa.checkin_datetime)) AS attendance_days,
                MAX(qa.checkin_datetime) AS last_attendance
              FROM members m
              INNER JOIN qr_attendance qa ON qa.member_id = m.id
              WHERE m.status = 'Active'
                AND DATE(qa.checkin_datetime) >= :thirty_days_ago
                AND qa.member_id IS NOT NULL
              GROUP BY m.id, m.first_name, m.middle_name, m.surname, m.suffix
              ORDER BY attendance_days DESC, last_attendance DESC
              LIMIT :limit";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':thirty_days_ago', $thirtyDaysAgo);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate engagement percentage (max 30 days = 100%)
    $formattedMembers = array_map(function($member) {
        $attendanceDays = (int)$member['attendance_days'];
        $engagementPercentage = min(100, round(($attendanceDays / 30) * 100));
        
        return [
            'id' => (int)$member['id'],
            'name' => $member['name'],
            'attendanceDays' => $attendanceDays,
            'percentage' => $engagementPercentage,
            'lastAttendance' => $member['last_attendance']
        ];
    }, $members);
    
    echo json_encode([
        'success' => true,
        'data' => $formattedMembers
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>


<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get last 7 days attendance using QR check-ins
    $weeklyData = [];
    $days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-$i days"));
        $dayName = date('D', strtotime("-$i days"));
        
        // Get attendance count for this day
        $query = "SELECT COUNT(DISTINCT qa.member_id) as count
                  FROM qr_attendance qa
                  WHERE DATE(qa.checkin_datetime) = :date
                  AND qa.member_id IS NOT NULL";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':date', $date);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $count = $result['count'] ?? 0;
        
        $weeklyData[] = [
            'day' => $dayName,
            'count' => (int)$count,
            'date' => $date
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $weeklyData
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

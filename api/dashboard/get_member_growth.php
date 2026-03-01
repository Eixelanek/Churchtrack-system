<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get last 7 months member growth
    $growthData = [];
    $months = [];
    
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-01', strtotime("-$i months"));
        $monthName = date('M', strtotime("-$i months"));
        $endOfMonth = date('Y-m-t', strtotime("-$i months"));
        
        // Count members who joined up to end of this month
        $query = "SELECT COUNT(*) as count
                  FROM members
                  WHERE created_at <= :end_date
                  AND status IN ('Active', 'Inactive')";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':end_date', $endOfMonth);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $count = $result['count'] ?? 0;
        
        $growthData[] = [
            'month' => $monthName,
            'count' => (int)$count,
            'date' => $date
        ];
    }
    
    // Calculate new members this month and growth rate
    $thisMonth = date('Y-m-01');
    $lastMonth = date('Y-m-01', strtotime('-1 month'));
    
    $newMembersQuery = "SELECT COUNT(*) as count
                        FROM members
                        WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(:this_month, '%Y-%m')
                        AND status IN ('Active', 'Inactive')";
    $stmt = $db->prepare($newMembersQuery);
    $stmt->bindParam(':this_month', $thisMonth);
    $stmt->execute();
    $newMembers = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;
    
    // Calculate growth rate
    $lastMonthCountQuery = "SELECT COUNT(*) as count
                            FROM members
                            WHERE created_at < :this_month
                            AND status IN ('Active', 'Inactive')";
    $stmt = $db->prepare($lastMonthCountQuery);
    $stmt->bindParam(':this_month', $thisMonth);
    $stmt->execute();
    $lastMonthCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;
    
    $growthRate = 0;
    if ($lastMonthCount > 0) {
        $growthRate = round(($newMembers / $lastMonthCount) * 100, 1);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $growthData,
        'newMembers' => (int)$newMembers,
        'growthRate' => (float)$growthRate
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

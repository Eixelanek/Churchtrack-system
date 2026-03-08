<?php
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Look at the last 30 days of QR check-ins to build the breakdown
    $startDate = date('Y-m-d', strtotime('-30 days'));

    $query = "SELECT 
                COALESCE(NULLIF(qs.service_name, ''), 'Unnamed Service') AS service_name,
                COUNT(DISTINCT qa.member_id) AS count
              FROM qr_attendance qa
              INNER JOIN qr_sessions qs ON qa.session_id = qs.id
              WHERE qa.member_id IS NOT NULL
                AND qa.checkin_datetime >= :start_date
              GROUP BY service_name
              ORDER BY count DESC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format the data
    $serviceData = [];
    $total = 0;
    
    foreach ($results as $row) {
        $count = (int)$row['count'];
        $total += $count;
        $serviceData[] = [
            'type' => $row['service_name'],
            'count' => $count
        ];
    }
    
    // Calculate percentages
    $formattedData = array_map(function($item) use ($total) {
        return [
            'type' => $item['type'],
            'count' => $item['count'],
            'percentage' => $total > 0 ? round(($item['count'] / $total) * 100, 1) : 0
        ];
    }, $serviceData);
    
    echo json_encode([
        'success' => true,
        'data' => $formattedData,
        'total' => $total
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

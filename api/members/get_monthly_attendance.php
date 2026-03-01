<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Get member ID from query parameter
$memberId = isset($_GET['member_id']) ? $_GET['member_id'] : null;

if (!$memberId) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Member ID is required"
    ]);
    exit();
}

try {
    $totalRecords = 0;
    $monthlyData = [];
    $debugInfo = [];
    
    // Check if qr_attendance table exists and get all records for this member
    try {
        $checkQuery = "SELECT COUNT(*) as total FROM qr_attendance WHERE member_id = :member_id";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $checkStmt->execute();
        $checkResult = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $totalRecords = (int)$checkResult['total'];
        
        // Get monthly attendance data grouped by month
        $query = "SELECT YEAR(checkin_datetime) AS yr, MONTH(checkin_datetime) AS mon, COUNT(*) AS count FROM qr_attendance WHERE member_id = :member_id GROUP BY yr, mon ORDER BY yr DESC, mon DESC LIMIT 7";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $stmt->execute();
        
        $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $monthIndex = (int)$row['mon'] - 1;
            $monthlyData[] = [
                'month' => $monthNames[$monthIndex],
                'year_month' => $row['yr'] . '-' . str_pad($row['mon'], 2, '0', STR_PAD_LEFT),
                'count' => (int)$row['count']
            ];
        }
        
        // Reverse array to show oldest to newest (left to right)
        $monthlyData = array_reverse($monthlyData);
        
    } catch (PDOException $tableError) {
        // Table might not exist, return empty data
        $totalRecords = 0;
        $monthlyData = [];
    }
    
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $monthlyData
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching monthly attendance: " . $e->getMessage()
    ]);
}
?>

<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Get all inactive members with their last attendance date
    $query = "SELECT 
                m.id,
                m.surname,
                m.first_name,
                m.middle_name,
                m.suffix,
                CONCAT(m.first_name, ' ', 
                       COALESCE(CONCAT(m.middle_name, ' '), ''), 
                       m.surname,
                       CASE WHEN m.suffix != 'None' THEN CONCAT(' ', m.suffix) ELSE '' END) as name,
                m.username,
                m.email,
                m.birthday,
                m.status,
                m.created_at,
                MAX(ar.attendance_date) as last_attendance
              FROM members m
              LEFT JOIN attendance_records ar ON m.id = ar.member_id
              WHERE m.status = 'inactive'
              GROUP BY m.id
              ORDER BY last_attendance DESC";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate days since last attendance for each member
    foreach ($members as &$member) {
        if ($member['last_attendance']) {
            $lastDate = new DateTime($member['last_attendance']);
            $today = new DateTime();
            $diff = $today->diff($lastDate);
            $member['days_since_attendance'] = $diff->days;
        } else {
            $member['days_since_attendance'] = null;
            $member['last_attendance'] = 'Never attended';
        }
    }
    
    http_response_code(200);
    echo json_encode($members);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching inactive members: " . $e->getMessage()
    ]);
}
?>

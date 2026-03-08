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

// Get referrer ID from query parameter
$referrerId = isset($_GET['referrer_id']) ? intval($_GET['referrer_id']) : null;

if (!$referrerId) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Referrer ID is required"
    ]);
    exit();
}

try {
    // Get all members referred by this member
    $query = "SELECT 
                m.id, 
                CONCAT(m.first_name, ' ', 
                       COALESCE(CONCAT(m.middle_name, ' '), ''), 
                       m.surname,
                       CASE WHEN m.suffix != 'None' THEN CONCAT(' ', m.suffix) ELSE '' END) as name,
                m.username, 
                m.email, 
                m.birthday, 
                m.status, 
                m.created_at,
                m.relationship_to_referrer
              FROM members m
              WHERE m.referrer_id = :referrer_id
              ORDER BY m.created_at DESC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':referrer_id', $referrerId, PDO::PARAM_INT);
    $stmt->execute();
    
    $referredMembers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Clean up fields
    foreach ($referredMembers as &$member) {
        $member['relationship_to_referrer'] = $member['relationship_to_referrer'] ?: null;
    }
    
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $referredMembers,
        "count" => count($referredMembers)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching referred members: " . $e->getMessage()
    ]);
}
?>


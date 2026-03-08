<?php
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
    // Get all family members for this primary member
    $query = "SELECT 
                id,
                primary_member_id,
                relationship_type,
                first_name,
                middle_name,
                surname,
                suffix,
                CONCAT(first_name, ' ', 
                       COALESCE(CONCAT(middle_name, ' '), ''), 
                       surname,
                       CASE WHEN suffix != 'None' THEN CONCAT(' ', suffix) ELSE '' END) as full_name,
                gender,
                birthday,
                contact_number,
                email,
                created_at
              FROM family_members
              WHERE primary_member_id = :member_id
              ORDER BY 
                CASE relationship_type
                    WHEN 'Spouse' THEN 1
                    WHEN 'Father' THEN 2
                    WHEN 'Mother' THEN 3
                    WHEN 'Son' THEN 4
                    WHEN 'Daughter' THEN 5
                    WHEN 'Brother' THEN 6
                    WHEN 'Sister' THEN 7
                    ELSE 8
                END,
                created_at ASC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':member_id', $memberId);
    $stmt->execute();
    
    $familyMembers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate age for each family member if birthday exists
    foreach ($familyMembers as &$member) {
        if ($member['birthday']) {
            $birthDate = new DateTime($member['birthday']);
            $today = new DateTime();
            $age = $today->diff($birthDate)->y;
            $member['age'] = $age;
        } else {
            $member['age'] = null;
        }
    }
    
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "count" => count($familyMembers),
        "family_members" => $familyMembers
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching family members: " . $e->getMessage()
    ]);
}
?>

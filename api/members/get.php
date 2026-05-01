<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Get member ID from query parameter
$memberId = isset($_GET['id']) ? $_GET['id'] : null;

if (!$memberId) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Member ID is required"
    ]);
    exit();
}

try {
    $hasProfilePicture = false;
    $hasEmailVerifiedAt = false;
    $hasMemberCreatedVia = false;
    try {
        $checkColumnQuery = "SHOW COLUMNS FROM members LIKE 'profile_picture'";
        $checkStmt = $db->query($checkColumnQuery);
        $hasProfilePicture = ($checkStmt->rowCount() > 0);
    } catch (Exception $e) {
        error_log("Column check error: " . $e->getMessage());
    }
    try {
        $checkEv = $db->query("SHOW COLUMNS FROM members LIKE 'email_verified_at'");
        $hasEmailVerifiedAt = $checkEv && $checkEv->rowCount() > 0;
    } catch (Exception $e) {
        error_log("Column check error: " . $e->getMessage());
    }
    try {
        $checkVia = $db->query("SHOW COLUMNS FROM members LIKE 'member_created_via'");
        $hasMemberCreatedVia = $checkVia && $checkVia->rowCount() > 0;
    } catch (Exception $e) {
        error_log("Column check error: " . $e->getMessage());
    }

    $emailVerifiedSelect = $hasEmailVerifiedAt ? 'email_verified_at' : 'NULL AS email_verified_at';
    $createdViaSelect = $hasMemberCreatedVia ? 'member_created_via' : "NULL AS member_created_via";

    // Build query based on column existence
    if ($hasProfilePicture) {
        $query = "SELECT 
                    id,
                    first_name,
                    middle_name,
                    surname,
                    suffix,
                    email,
                    $emailVerifiedSelect,
                    $createdViaSelect,
                    username,
                    birthday,
                    contact_number,
                    gender,
                    street,
                    barangay,
                    city,
                    province,
                    zip_code,
                    guardian_first_name,
                    guardian_middle_name,
                    guardian_surname,
                    guardian_suffix,
                    relationship_to_guardian,
                    profile_picture,
                    status,
                    created_at,
                    updated_at
                  FROM members
                  WHERE id = :member_id";
    } else {
        $query = "SELECT 
                    id,
                    first_name,
                    middle_name,
                    surname,
                    suffix,
                    email,
                    $emailVerifiedSelect,
                    $createdViaSelect,
                    username,
                    birthday,
                    contact_number,
                    gender,
                    street,
                    barangay,
                    city,
                    province,
                    zip_code,
                    guardian_first_name,
                    guardian_middle_name,
                    guardian_surname,
                    guardian_suffix,
                    relationship_to_guardian,
                    NULL as profile_picture,
                    status,
                    created_at,
                    updated_at
                  FROM members
                  WHERE id = :member_id";
    }
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':member_id', $memberId);
    $stmt->execute();
    $member = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$member) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Member not found"
        ]);
        exit();
    }
    
    // Return member data
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "member" => $member
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error fetching member details: " . $e->getMessage()
    ]);
}
?>

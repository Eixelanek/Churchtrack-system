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

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (!isset($data->member_id) || !isset($data->current_password) || !isset($data->new_password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Missing required fields"
    ]);
    exit();
}

$memberId = $data->member_id;
$currentPassword = $data->current_password;
$newPassword = $data->new_password;

try {
    // Get current password hash from database
    $query = "SELECT password FROM members WHERE id = :member_id";
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
    
    // Verify current password
    if (!password_verify($currentPassword, $member['password'])) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Current password is incorrect"
        ]);
        exit();
    }
    
    // Hash new password
    $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // Update password
    $updateQuery = "UPDATE members SET password = :password, must_change_password = 0, password_temp_expires_at = NULL, updated_at = NOW() WHERE id = :member_id";
    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->bindParam(':password', $newPasswordHash);
    $updateStmt->bindParam(':member_id', $memberId);
    
    if ($updateStmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Password updated successfully"
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to update password"
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error updating password: " . $e->getMessage()
    ]);
}
?>

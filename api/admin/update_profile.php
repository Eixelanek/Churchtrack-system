<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->admin_id)) {
    // Update admin profile information
    $query = "UPDATE admin SET 
              first_name = :first_name,
              last_name = :last_name,
              birthday = :birthday,
              email = :email,
              profile_picture = :profile_picture,
              updated_at = NOW()
              WHERE id = :admin_id";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(":first_name", $data->firstName);
    $stmt->bindParam(":last_name", $data->lastName);
    $stmt->bindParam(":birthday", $data->birthday);
    $stmt->bindParam(":email", $data->email);
    $stmt->bindParam(":profile_picture", $data->profilePicture);
    $stmt->bindParam(":admin_id", $data->admin_id);
    
    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "message" => "Profile updated successfully.",
            "status" => "success"
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            "message" => "Unable to update profile.",
            "status" => "error"
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode([
        "message" => "Admin ID is required.",
        "status" => "error"
    ]);
}
?>

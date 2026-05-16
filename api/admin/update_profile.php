<?php
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include_once '../config/database.php';
require_once __DIR__ . '/../config/cloudinary.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->admin_id)) {
    http_response_code(400);
    echo json_encode(['message' => 'Admin ID is required.', 'status' => 'error']);
    exit();
}

// Upload to Cloudinary if base64 data URI
$profilePicture = $data->profilePicture ?? null;
if ($profilePicture && preg_match('/^data:image\/\w+;base64,/', $profilePicture)) {
    $upload = uploadToCloudinary($profilePicture, 'profile_pictures');
    if ($upload['success']) {
        $profilePicture = $upload['url'];
    }
}

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
$stmt->bindParam(":profile_picture", $profilePicture);
$stmt->bindParam(":admin_id", $data->admin_id);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(['message' => 'Profile updated successfully.', 'status' => 'success', 'profilePicture' => $profilePicture]);
} else {
    http_response_code(503);
    echo json_encode(['message' => 'Unable to update profile.', 'status' => 'error']);
}
?>

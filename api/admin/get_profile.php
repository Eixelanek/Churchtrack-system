<?php
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Get admin ID from query parameter (for now use ID 1 as default)
$admin_id = isset($_GET['admin_id']) ? $_GET['admin_id'] : 1;

try {
    $query = "SELECT id, first_name, last_name, birthday, email, profile_picture, role, created_at 
              FROM admin 
              WHERE id = :admin_id";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(":admin_id", $admin_id);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Use profile picture if exists, otherwise use initials
        $firstName = $admin['first_name'] ?: '';
        $lastName = $admin['last_name'] ?: '';
        $avatar = $admin['profile_picture'] ? $admin['profile_picture'] : strtoupper(substr($firstName, 0, 1) . substr($lastName, 0, 1));
        
        echo json_encode([
            "success" => true,
            "data" => [
                "id" => (int)$admin['id'],
                "firstName" => $admin['first_name'],
                "lastName" => $admin['last_name'],
                "birthday" => $admin['birthday'],
                "email" => $admin['email'],
                "role" => $admin['role'],
                "avatar" => $avatar,
                "profilePicture" => $admin['profile_picture'],
                "joinedDate" => date('F Y', strtotime($admin['created_at']))
            ]
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Admin not found."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>

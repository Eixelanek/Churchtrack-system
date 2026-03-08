<?php
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    
    if (!empty($data->admin_id) && !empty($data->currentPassword) && !empty($data->newPassword)) {
        try {
            // First, verify the current password
            $query = "SELECT password FROM admin WHERE id = :admin_id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":admin_id", $data->admin_id);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Verify current password
                if (password_verify($data->currentPassword, $row['password'])) {
                    // Hash the new password
                    $hashedPassword = password_hash($data->newPassword, PASSWORD_DEFAULT);
                    
                    // Update password
                    $updateQuery = "UPDATE admin SET 
                                   password = :password,
                                   updated_at = NOW()
                                   WHERE id = :admin_id";
                    
                    $updateStmt = $db->prepare($updateQuery);
                    $updateStmt->bindParam(":password", $hashedPassword);
                    $updateStmt->bindParam(":admin_id", $data->admin_id);
                    
                    if ($updateStmt->execute()) {
                        http_response_code(200);
                        echo json_encode([
                            "message" => "Password updated successfully.",
                            "status" => "success"
                        ]);
                    } else {
                        http_response_code(503);
                        echo json_encode([
                            "message" => "Unable to update password.",
                            "status" => "error"
                        ]);
                    }
                } else {
                    http_response_code(401);
                    echo json_encode([
                        "message" => "Current password is incorrect.",
                        "status" => "error"
                    ]);
                }
            } else {
                http_response_code(404);
                echo json_encode([
                    "message" => "Admin not found.",
                    "status" => "error"
                ]);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                "message" => "Database error: " . $e->getMessage(),
                "status" => "error"
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode([
            "message" => "Admin ID, current password, and new password are required.",
            "status" => "error"
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        "message" => "Method not allowed.",
        "status" => "error"
    ]);
}
?>

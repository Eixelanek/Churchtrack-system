<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

// Get the posted data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (!isset($data->member_id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Member ID is required"
    ]);
    exit();
}

try {
    $memberId = $data->member_id;
    
    // Check if profile_picture column exists, if not create it
    try {
        $checkColumnQuery = "SHOW COLUMNS FROM members LIKE 'profile_picture'";
        $checkStmt = $db->query($checkColumnQuery);
        if ($checkStmt->rowCount() === 0) {
            // Column doesn't exist, create it
            $alterQuery = "ALTER TABLE members ADD COLUMN profile_picture VARCHAR(255) NULL AFTER email";
            $db->exec($alterQuery);
        }
    } catch (Exception $e) {
        // Ignore if column already exists or other minor issues
        error_log("Profile picture column check: " . $e->getMessage());
    }
    
    // Build update query dynamically based on provided fields
    $updateFields = [];
    $params = [':member_id' => $memberId];
    
    if (isset($data->first_name)) {
        $updateFields[] = "first_name = :first_name";
        $params[':first_name'] = $data->first_name;
    }
    
    if (isset($data->middle_name)) {
        $updateFields[] = "middle_name = :middle_name";
        $params[':middle_name'] = $data->middle_name;
    }
    
    if (isset($data->last_name)) {
        $updateFields[] = "surname = :surname";
        $params[':surname'] = $data->last_name;
    }
    
    if (isset($data->suffix)) {
        $updateFields[] = "suffix = :suffix";
        $params[':suffix'] = $data->suffix;
    }
    
    if (isset($data->contact_number)) {
        $updateFields[] = "contact_number = :contact_number";
        $params[':contact_number'] = $data->contact_number;
    }
    
    if (isset($data->gender)) {
        $updateFields[] = "gender = :gender";
        $params[':gender'] = $data->gender;
    }
    
    if (isset($data->birthday)) {
        $updateFields[] = "birthday = :birthday";
        $params[':birthday'] = $data->birthday;
    }
    
    if (isset($data->street)) {
        $updateFields[] = "street = :street";
        $params[':street'] = $data->street;
    }
    
    if (isset($data->barangay)) {
        $updateFields[] = "barangay = :barangay";
        $params[':barangay'] = $data->barangay;
    }
    
    if (isset($data->city)) {
        $updateFields[] = "city = :city";
        $params[':city'] = $data->city;
    }
    
    if (isset($data->province)) {
        $updateFields[] = "province = :province";
        $params[':province'] = $data->province;
    }
    
    if (isset($data->zip_code)) {
        $updateFields[] = "zip_code = :zip_code";
        $params[':zip_code'] = $data->zip_code;
    }
    
    if (isset($data->guardian_first_name)) {
        $updateFields[] = "guardian_first_name = :guardian_first_name";
        $params[':guardian_first_name'] = $data->guardian_first_name;
    }
    
    if (isset($data->guardian_middle_name)) {
        $updateFields[] = "guardian_middle_name = :guardian_middle_name";
        $params[':guardian_middle_name'] = $data->guardian_middle_name;
    }
    
    if (isset($data->guardian_surname)) {
        $updateFields[] = "guardian_surname = :guardian_surname";
        $params[':guardian_surname'] = $data->guardian_surname;
    }
    
    if (isset($data->guardian_suffix)) {
        $updateFields[] = "guardian_suffix = :guardian_suffix";
        $params[':guardian_suffix'] = $data->guardian_suffix;
    }
    
    if (isset($data->relationship_to_guardian)) {
        $updateFields[] = "relationship_to_guardian = :relationship_to_guardian";
        $params[':relationship_to_guardian'] = $data->relationship_to_guardian;
    }
    
    if (isset($data->email)) {
        // Check if email is already used by another member
        $emailCheckQuery = "SELECT id FROM members WHERE email = :email AND id != :member_id";
        $emailStmt = $db->prepare($emailCheckQuery);
        $emailStmt->bindParam(':email', $data->email);
        $emailStmt->bindParam(':member_id', $memberId);
        $emailStmt->execute();
        
        if ($emailStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Email is already in use by another member"
            ]);
            exit();
        }
        
        $updateFields[] = "email = :email";
        $params[':email'] = $data->email;
    }
    
    // Handle profile picture upload
    if (isset($data->profile_picture) && !empty($data->profile_picture)) {
        // Decode base64 image
        $imageData = $data->profile_picture;
        
        // Check if it's a base64 string
        if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
            $imageData = substr($imageData, strpos($imageData, ',') + 1);
            $type = strtolower($type[1]); // jpg, png, gif
            
            if (!in_array($type, ['jpg', 'jpeg', 'png', 'gif'])) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid image type. Only JPG, PNG, and GIF are allowed."
                ]);
                exit();
            }
            
            $imageData = base64_decode($imageData);
            
            if ($imageData === false) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to decode image data"
                ]);
                exit();
            }
            
            // Create uploads directory if it doesn't exist
            $uploadDir = '../../uploads/profile_pictures/';
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            
            // Generate unique filename
            $filename = 'member_' . $memberId . '_' . time() . '.' . $type;
            $filepath = $uploadDir . $filename;
            
            // Save the image
            if (file_put_contents($filepath, $imageData)) {
                // Delete old profile picture if exists
                $oldPictureQuery = "SELECT profile_picture FROM members WHERE id = :member_id";
                $oldPictureStmt = $db->prepare($oldPictureQuery);
                $oldPictureStmt->bindParam(':member_id', $memberId);
                $oldPictureStmt->execute();
                $oldPicture = $oldPictureStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($oldPicture && !empty($oldPicture['profile_picture'])) {
                    $oldFilePath = '../../' . ltrim($oldPicture['profile_picture'], '/');
                    if (file_exists($oldFilePath)) {
                        unlink($oldFilePath);
                    }
                }
                
                $updateFields[] = "profile_picture = :profile_picture";
                $params[':profile_picture'] = '/uploads/profile_pictures/' . $filename;
            } else {
                http_response_code(500);
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to save profile picture"
                ]);
                exit();
            }
        }
    }
    
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "No fields to update"
        ]);
        exit();
    }
    
    // Add updated_at timestamp
    $updateFields[] = "updated_at = NOW()";
    
    // Build and execute update query
    $query = "UPDATE members SET " . implode(", ", $updateFields) . " WHERE id = :member_id";
    $stmt = $db->prepare($query);
    
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    if ($stmt->execute()) {
        // Fetch updated member data
        $fetchQuery = "SELECT id, first_name, middle_name, surname, email, profile_picture FROM members WHERE id = :member_id";
        $fetchStmt = $db->prepare($fetchQuery);
        $fetchStmt->bindParam(':member_id', $memberId);
        $fetchStmt->execute();
        $updatedMember = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Profile updated successfully",
            "member" => $updatedMember
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to update profile"
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error updating profile: " . $e->getMessage()
    ]);
}
?>

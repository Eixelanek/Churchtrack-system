<?php
// CORS: production + Vercel previews + localhost; optional CORS_ALLOWED_ORIGINS (comma-separated)
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$fromEnv = array_filter(array_map('trim', explode(',', (string) getenv('CORS_ALLOWED_ORIGINS'))));
$allowList = array_values(array_unique(array_merge(
    [
        'https://churchtrack-system.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
    ],
    $fromEnv
)));

$allowOrigin = 'https://churchtrack-system.vercel.app';
if ($requestOrigin !== '') {
    if (in_array($requestOrigin, $allowList, true)) {
        $allowOrigin = $requestOrigin;
    } elseif (preg_match('#^https://[^/]+\.vercel\.app$#i', $requestOrigin)) {
        $allowOrigin = $requestOrigin;
    }
}

header('Access-Control-Allow-Origin: ' . $allowOrigin);
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

error_reporting(E_ALL);
$isProd = getenv('RENDER') || getenv('RAILWAY_ENVIRONMENT');
ini_set('display_errors', $isProd ? '0' : '1');

$database = new Database();
$db = $database->getConnection();

function memberTableColumns(PDO $db) {
    $stmt = $db->query('SHOW COLUMNS FROM members');
    $cols = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $cols[$row['Field']] = true;
    }
    return $cols;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput);
if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON body',
    ]);
    exit();
}
if (!is_object($data) || !isset($data->member_id)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Member ID is required',
    ]);
    exit();
}

try {
    $memberId = $data->member_id;
    
    // Check if guardian_middle_name column exists, if not create it
    try {
        $checkColumnQuery = "SHOW COLUMNS FROM members LIKE 'guardian_middle_name'";
        $checkStmt = $db->query($checkColumnQuery);
        if ($checkStmt->rowCount() === 0) {
            // Column doesn't exist, create it
            $alterQuery = "ALTER TABLE members ADD COLUMN guardian_middle_name VARCHAR(100) NULL AFTER guardian_first_name";
            $db->exec($alterQuery);
        }
    } catch (Exception $e) {
        // Log the error but continue
        error_log("Guardian middle name column check: " . $e->getMessage());
    }
    
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
        // Log the error but continue
        error_log("Profile picture column check: " . $e->getMessage());
    }

    $validCols = memberTableColumns($db);
    
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
    
    if (isset($data->guardian_middle_name) && !empty($validCols['guardian_middle_name'])) {
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
        if (empty($validCols['profile_picture'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Profile picture column is missing. Ask an admin to run the database migration (profile_picture on members).',
            ]);
            exit();
        }
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
    
    if (!empty($validCols['updated_at'])) {
        $updateFields[] = "updated_at = NOW()";
    }
    
    if (!empty($validCols['full_name']) && (isset($data->first_name) || isset($data->middle_name) || isset($data->last_name) || isset($data->suffix))) {
        $updateFields[] = "full_name = TRIM(CONCAT(
            COALESCE(first_name, ''), 
            CASE WHEN middle_name IS NOT NULL AND middle_name != '' THEN CONCAT(' ', middle_name) ELSE '' END,
            CASE WHEN surname IS NOT NULL AND surname != '' THEN CONCAT(' ', surname) ELSE '' END,
            CASE WHEN suffix IS NOT NULL AND suffix != 'None' AND suffix != '' THEN CONCAT(' ', suffix) ELSE '' END
        ))";
    }
    
    // Build and execute update query
    $query = "UPDATE members SET " . implode(", ", $updateFields) . " WHERE id = :member_id";
    
    error_log('Update query: ' . $query);
    $paramLog = json_encode($params, JSON_INVALID_UTF8_SUBSTITUTE);
    if ($paramLog !== false) {
        error_log('Parameters: ' . $paramLog);
    }
    
    $stmt = $db->prepare($query);
    
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    if ($stmt->execute()) {
        $nameExpr = "TRIM(CONCAT(
            COALESCE(first_name, ''), 
            CASE WHEN middle_name IS NOT NULL AND middle_name != '' THEN CONCAT(' ', middle_name) ELSE '' END,
            CASE WHEN surname IS NOT NULL AND surname != '' THEN CONCAT(' ', surname) ELSE '' END,
            CASE WHEN suffix IS NOT NULL AND suffix != 'None' AND suffix != '' THEN CONCAT(' ', suffix) ELSE '' END
        )) as full_name";
        $wantCols = [
            'id', 'first_name', 'middle_name', 'surname', 'suffix', 'email', 'contact_number',
            'gender', 'birthday', 'street', 'barangay', 'city', 'province', 'zip_code',
            'guardian_first_name', 'guardian_middle_name', 'guardian_surname', 'guardian_suffix',
            'relationship_to_guardian', 'profile_picture',
        ];
        $selectParts = [];
        foreach ($wantCols as $col) {
            if (!empty($validCols[$col])) {
                $selectParts[] = $col;
            }
        }
        $selectParts[] = $nameExpr;
        $fetchQuery = 'SELECT ' . implode(', ', $selectParts) . ' FROM members WHERE id = :member_id';
        $fetchStmt = $db->prepare($fetchQuery);
        
        $fetchStmt->bindParam(':member_id', $memberId);
        if (!$fetchStmt->execute()) {
            throw new Exception('Failed to execute fetch statement: ' . implode(', ', $fetchStmt->errorInfo()));
        }
        
        $updatedMember = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Profile updated successfully",
            "member" => $updatedMember
        ]);
    } else {
        $errorInfo = $stmt->errorInfo();
        error_log("SQL Error: " . implode(", ", $errorInfo));
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to update profile: " . $errorInfo[2]
        ]);
    }
    
} catch (Throwable $e) {
    error_log('update_profile: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error updating profile: ' . $e->getMessage(),
    ]);
}
?>

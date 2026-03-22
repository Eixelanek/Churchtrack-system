<?php
// Do not set CORS here — apache-config.conf already sends ACAO (duplicate headers break browsers)
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

$memberId = (int) $data->member_id;
if ($memberId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid member ID',
    ]);
    exit();
}

try {
    
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

    $updateFields = [];
    $params = [':member_id' => $memberId];

    $setIfPresent = function ($jsonKey, $column, $paramName) use ($data, &$updateFields, &$params, $validCols) {
        if (empty($validCols[$column]) || !property_exists($data, $jsonKey)) {
            return;
        }
        $val = $data->{$jsonKey};
        $updateFields[] = "{$column} = {$paramName}";
        $params[$paramName] = $val;
    };
    
    $setIfPresent('first_name', 'first_name', ':first_name');
    $setIfPresent('middle_name', 'middle_name', ':middle_name');
    $setIfPresent('last_name', 'surname', ':surname');
    $setIfPresent('suffix', 'suffix', ':suffix');
    $setIfPresent('contact_number', 'contact_number', ':contact_number');
    $setIfPresent('gender', 'gender', ':gender');
    // Empty birthday string breaks MySQL DATE / strict mode when the app always sends all keys
    if (!empty($validCols['birthday']) && property_exists($data, 'birthday')) {
        $b = $data->birthday;
        if ($b !== null && $b !== '') {
            $b = trim((string) $b);
            if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $b, $m)) {
                $b = $m[1];
            }
            $updateFields[] = 'birthday = :birthday';
            $params[':birthday'] = $b;
        }
    }
    $setIfPresent('street', 'street', ':street');
    $setIfPresent('barangay', 'barangay', ':barangay');
    $setIfPresent('city', 'city', ':city');
    $setIfPresent('province', 'province', ':province');
    $setIfPresent('zip_code', 'zip_code', ':zip_code');
    $setIfPresent('guardian_first_name', 'guardian_first_name', ':guardian_first_name');
    if (!empty($validCols['guardian_middle_name']) && property_exists($data, 'guardian_middle_name')) {
        $updateFields[] = 'guardian_middle_name = :guardian_middle_name';
        $params[':guardian_middle_name'] = $data->guardian_middle_name;
    }
    $setIfPresent('guardian_surname', 'guardian_surname', ':guardian_surname');
    $setIfPresent('guardian_suffix', 'guardian_suffix', ':guardian_suffix');
    $setIfPresent('relationship_to_guardian', 'relationship_to_guardian', ':relationship_to_guardian');
    
    if (!empty($validCols['email']) && property_exists($data, 'email')) {
        $emailVal = $data->email;
        if ($emailVal !== null && trim((string) $emailVal) !== '') {
            $emailTrim = trim((string) $emailVal);
            $emailCheckQuery = 'SELECT id FROM members WHERE email = :email AND id != :member_id';
            $emailStmt = $db->prepare($emailCheckQuery);
            $emailStmt->bindValue(':email', $emailTrim);
            $emailStmt->bindValue(':member_id', $memberId, PDO::PARAM_INT);
            $emailStmt->execute();
            if ($emailStmt->fetch()) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email is already in use by another member',
                ]);
                exit();
            }
            $updateFields[] = 'email = :email';
            $params[':email'] = $emailTrim;
        }
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
            
            // Paths relative to this file — CWD is often DocumentRoot, NOT api/members
            $uploadDir = __DIR__ . '/../../uploads/profile_pictures/';
            if (!is_dir($uploadDir)) {
                if (!mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Cannot create upload directory on server',
                    ]);
                    exit();
                }
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
                    $rel = ltrim((string) $oldPicture['profile_picture'], '/');
                    $oldFilePath = __DIR__ . '/../../' . $rel;
                    if (is_file($oldFilePath)) {
                        @unlink($oldFilePath);
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

    // full_name is a generated column in production DB — cannot SET it (MySQL error 3105)
    
    // Build and execute update query
    $query = "UPDATE members SET " . implode(", ", $updateFields) . " WHERE id = :member_id";
    
    error_log('Update query: ' . $query);
    $paramLog = json_encode($params);
    if ($paramLog !== false) {
        error_log('Parameters: ' . $paramLog);
    }
    
    $stmt = $db->prepare($query);
    
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    $stmt->execute();

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
        if (!empty($validCols['full_name'])) {
            $selectParts[] = 'full_name';
        } else {
            $selectParts[] = "TRIM(CONCAT(
            COALESCE(first_name, ''), 
            CASE WHEN middle_name IS NOT NULL AND middle_name != '' THEN CONCAT(' ', middle_name) ELSE '' END,
            CASE WHEN surname IS NOT NULL AND surname != '' THEN CONCAT(' ', surname) ELSE '' END,
            CASE WHEN suffix IS NOT NULL AND suffix != 'None' AND suffix != '' THEN CONCAT(' ', suffix) ELSE '' END
        )) AS full_name";
        }
        $fetchQuery = 'SELECT ' . implode(', ', $selectParts) . ' FROM members WHERE id = :member_id';
        $fetchStmt = $db->prepare($fetchQuery);
        
        $fetchStmt->bindValue(':member_id', $memberId, PDO::PARAM_INT);
        if (!$fetchStmt->execute()) {
            throw new Exception('Failed to execute fetch statement: ' . implode(', ', $fetchStmt->errorInfo()));
        }
        
        $updatedMember = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        $payload = json_encode([
            'success' => true,
            'message' => 'Profile updated successfully',
            'member' => $updatedMember,
        ]);
        echo $payload !== false ? $payload : '{"success":false,"message":"JSON encode failed"}';
    
} catch (Throwable $e) {
    error_log('update_profile: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error updating profile: ' . $e->getMessage(),
    ]);
}

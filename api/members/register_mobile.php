<?php
// Mobile-specific registration endpoint
// Simplified version to avoid mobile browser issues

// Clear any existing headers first
if (!headers_sent()) {
    header_remove('Access-Control-Allow-Origin');
    header_remove('Access-Control-Allow-Methods');
    header_remove('Access-Control-Allow-Headers');
}

// Set CORS headers - mobile specific
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://churchtrack-system.vercel.app");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Max-Age: 3600");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit();
}

try {
    include_once '../config/database.php';
    
    // Get posted data
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);
    
    if (!$data) {
        throw new Exception("Invalid JSON data");
    }
    
    // Validate required fields
    $required = ['surname', 'firstName', 'username', 'password', 'birthday', 'contactNumber', 'gender', 'street', 'barangay', 'city', 'province', 'zipCode'];
    
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Connect to database
    $database = new Database();
    $db = $database->getConnection();
    
    // Check if username exists
    $check_query = "SELECT id FROM members WHERE username = :username AND status != 'rejected'";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(":username", $data['username']);
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() > 0) {
        throw new Exception("Username already exists");
    }
    
    // Hash password
    $hashed_password = password_hash($data['password'], PASSWORD_DEFAULT);
    
    // Calculate age
    $birthDate = new DateTime($data['birthday']);
    $today = new DateTime();
    $age = $today->diff($birthDate)->y;
    
    // Validate guardian info for minors
    if ($age <= 17) {
        if (empty($data['guardianSurname']) || empty($data['guardianFirstName']) || empty($data['relationshipToGuardian'])) {
            throw new Exception("Guardian information is required for members 17 years old and below");
        }
    }
    
    // Check email if provided
    if (!empty($data['email'])) {
        $check_email_query = "SELECT id FROM members WHERE email = :email AND status != 'rejected'";
        $check_email_stmt = $db->prepare($check_email_query);
        $check_email_stmt->bindParam(":email", $data['email']);
        $check_email_stmt->execute();
        
        if ($check_email_stmt->rowCount() > 0) {
            throw new Exception("Email already exists");
        }
    }
    
    // Insert member
    $query = "INSERT INTO members 
              (surname, first_name, middle_name, suffix, gender, birthday, email, contact_number,
               guardian_surname, guardian_first_name, guardian_middle_name, guardian_suffix, relationship_to_guardian,
               street, barangay, city, province, zip_code, referrer_id, referrer_name, relationship_to_referrer, username, password, status) 
              VALUES 
              (:surname, :first_name, :middle_name, :suffix, :gender, :birthday, :email, :contact_number,
               :guardian_surname, :guardian_first_name, :guardian_middle_name, :guardian_suffix, :relationship_to_guardian,
               :street, :barangay, :city, :province, :zip_code, :referrer_id, :referrer_name, :relationship_to_referrer, :username, :password, 'pending')";
    
    $stmt = $db->prepare($query);
    
    // Bind parameters
    $stmt->bindParam(":surname", $data['surname']);
    $stmt->bindParam(":first_name", $data['firstName']);
    $stmt->bindValue(":middle_name", $data['middleName'] ?? null);
    $stmt->bindValue(":suffix", $data['suffix'] ?? 'None');
    $stmt->bindParam(":gender", $data['gender']);
    $stmt->bindParam(":birthday", $data['birthday']);
    $stmt->bindValue(":email", $data['email'] ?? null);
    $stmt->bindParam(":contact_number", $data['contactNumber']);
    $stmt->bindValue(":guardian_surname", ($age <= 17) ? ($data['guardianSurname'] ?? null) : null);
    $stmt->bindValue(":guardian_first_name", ($age <= 17) ? ($data['guardianFirstName'] ?? null) : null);
    $stmt->bindValue(":guardian_middle_name", ($age <= 17) ? ($data['guardianMiddleName'] ?? null) : null);
    $stmt->bindValue(":guardian_suffix", ($age <= 17) ? ($data['guardianSuffix'] ?? 'None') : 'None');
    $stmt->bindValue(":relationship_to_guardian", ($age <= 17) ? ($data['relationshipToGuardian'] ?? null) : null);
    $stmt->bindParam(":street", $data['street']);
    $stmt->bindParam(":barangay", $data['barangay']);
    $stmt->bindParam(":city", $data['city']);
    $stmt->bindParam(":province", $data['province']);
    $stmt->bindParam(":zip_code", $data['zipCode']);
    $stmt->bindValue(":referrer_id", $data['referrerId'] ?? null);
    $stmt->bindValue(":referrer_name", null); // Will be populated if referrer exists
    $stmt->bindValue(":relationship_to_referrer", $data['relationshipToReferrer'] ?? null);
    $stmt->bindParam(":username", $data['username']);
    $stmt->bindParam(":password", $hashed_password);
    
    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "message" => "Registration successful. Please wait for admin approval.",
            "status" => "pending"
        ]);
    } else {
        throw new Exception("Unable to complete registration");
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["message" => $e->getMessage()]);
}
?>
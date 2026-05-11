<?php
// Mobile-specific registration endpoint
// Simplified version to avoid mobile browser issues

// CORS: apache-config.conf sets ACAO (duplicate PHP + Apache headers become "*, *" and break fetch)
header('Content-Type: application/json; charset=UTF-8');

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
    require_once __DIR__ . '/email_verification_utils.php';
    
    // Get posted data
    $input = file_get_contents("php://input");
    error_log("Mobile registration input: " . $input);
    
    $data = json_decode($input, true);
    
    if (!$data) {
        error_log("Mobile registration: Invalid JSON data");
        throw new Exception("Invalid JSON data");
    }
    
    error_log("Mobile registration data: " . json_encode($data));
    
    // Validate required fields
    $required = ['surname', 'firstName', 'username', 'password', 'birthday', 'email', 'gender', 'street', 'barangay', 'city', 'province', 'zipCode'];
    
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Connect to database
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);
    ensureMemberCreatedViaColumn($db);
    
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
    
    // Check email uniqueness
    // For minors (17 and below), allow duplicate emails (parent's email)
    // For 18+, check for duplicate emails
    if ($age >= 18) {
        $check_email_query = "SELECT id FROM members WHERE email = :email AND status != 'rejected'";
        $check_email_stmt = $db->prepare($check_email_query);
        $check_email_stmt->bindParam(":email", $data['email']);
        $check_email_stmt->execute();
        
        if ($check_email_stmt->rowCount() > 0) {
            throw new Exception("Email already exists");
        }
    }
    
    $verificationToken = generateEmailVerificationToken();
    $verificationExpiresAt = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');
    
    // For minors, generate parent approval token
    $parentApprovalToken = null;
    if ($age <= 17) {
        $parentApprovalToken = generateEmailVerificationToken();
    }

    // Insert member
    $query = "INSERT INTO members 
              (surname, first_name, middle_name, suffix, gender, birthday, email, email_verified_at, email_verification_token, email_verification_expires_at, parent_approval_token, contact_number,
               guardian_surname, guardian_first_name, guardian_middle_name, guardian_suffix, relationship_to_guardian,
               street, barangay, city, province, zip_code, referrer_id, referrer_name, relationship_to_referrer, username, password, status) 
              VALUES 
              (:surname, :first_name, :middle_name, :suffix, :gender, :birthday, :email, :email_verified_at, :email_verification_token, :email_verification_expires_at, :parent_approval_token, :contact_number,
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
    $stmt->bindParam(":email", $data['email']);
    $stmt->bindValue(":email_verified_at", null, PDO::PARAM_NULL);
    $stmt->bindParam(":email_verification_token", $verificationToken);
    $stmt->bindParam(":email_verification_expires_at", $verificationExpiresAt);
    if ($parentApprovalToken !== null) {
        $stmt->bindParam(":parent_approval_token", $parentApprovalToken);
    } else {
        $stmt->bindValue(":parent_approval_token", null, PDO::PARAM_NULL);
    }
    $contactNumber = isset($data['contactNumber']) && trim((string)$data['contactNumber']) !== '' ? $data['contactNumber'] : null;
    if ($contactNumber !== null) {
        $stmt->bindParam(":contact_number", $contactNumber);
    } else {
        $stmt->bindValue(":contact_number", null, PDO::PARAM_NULL);
    }
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
        $newMemberId = (int) $db->lastInsertId();
        require_once __DIR__ . '/../family/link_at_registration.php';
        $familyLinks = isset($data['familyLinks']) ? $data['familyLinks'] : null;
        link_family_after_registration($db, $newMemberId, $familyLinks, $age);
        $displayName = trim(($data['firstName'] ?? '') . ' ' . ($data['surname'] ?? ''));
        
        // For minors, send parent notification instead of regular verification email
        if ($age <= 17) {
            $guardianName = trim(($data['guardianFirstName'] ?? '') . ' ' . ($data['guardianSurname'] ?? ''));
            $emailSendResult = sendParentNotificationEmail($db, $data['email'], $displayName, $guardianName, $parentApprovalToken);
        } else {
            // For adults, send regular verification email
            $emailSendResult = sendEmailVerificationLink($db, $data['email'], $displayName, $verificationToken);
        }

        http_response_code(201);
        echo json_encode([
            "message" => "Registration successful. Please verify your email and wait for admin approval.",
            "status" => "pending",
            "email_verification_sent" => $emailSendResult['success'],
            "email_verification_message" => $emailSendResult['message']
        ]);
    } else {
        throw new Exception("Unable to complete registration");
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["message" => $e->getMessage()]);
}
?>
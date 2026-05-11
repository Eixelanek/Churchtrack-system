<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

// Simple error handling for mobile compatibility
if (!function_exists('handleError')) {
    function handleError($message, $code = 400) {
        http_response_code($code);
        echo json_encode(["message" => $message]);
        exit();
    }
}

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';

// Auto-cleaning: Delete rejected members older than 30 days
try {
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);
    ensureMemberCreatedViaColumn($db);
    $cleanup_query = "DELETE FROM members WHERE status = 'rejected' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
    $db->prepare($cleanup_query)->execute();
    // Auto-cleaning: Delete expired and used verification codes
    $cleanup_codes_query = "DELETE FROM verification_codes WHERE is_used = TRUE OR created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)";
    $db->prepare($cleanup_codes_query)->execute();
} catch (Exception $e) {
    // If database connection fails, return JSON error
    handleError("Database connection failed", 500);
}

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (
    !empty($data->surname) &&
    !empty($data->firstName) &&
    !empty($data->username) &&
    !empty($data->password) &&
    !empty($data->birthday) &&
    !empty($data->email) &&
    !empty($data->gender) &&
    !empty($data->street) &&
    !empty($data->barangay) &&
    !empty($data->city) &&
    !empty($data->province) &&
    !empty($data->zipCode)
) {
    // Check if username already exists (excluding rejected members)
    $check_query = "SELECT id FROM members WHERE username = :username AND status != 'rejected'";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(":username", $data->username);
    $check_stmt->execute();

    if ($check_stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(["message" => "Username already exists"]);
        exit();
    }

    // Hash the password
    $hashed_password = password_hash($data->password, PASSWORD_DEFAULT);

    // Calculate age for guardian validation
    $birthDate = new DateTime($data->birthday);
    $today = new DateTime();
    $age = $today->diff($birthDate)->y;

    // Validate guardian information for minors (17 and below)
    if ($age <= 17) {
        if (empty($data->guardianSurname) || empty($data->guardianFirstName) || empty($data->relationshipToGuardian)) {
            http_response_code(400);
            echo json_encode(["message" => "Guardian information is required for members 17 years old and below"]);
            exit();
        }
    }

    $verificationToken = generateEmailVerificationToken();
    $verificationExpiresAt = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');
    
    // For minors, generate parent approval token
    $parentApprovalToken = null;
    if ($age <= 17) {
        $parentApprovalToken = generateEmailVerificationToken();
    }

    // Insert new member with comprehensive data
    $query = "INSERT INTO members 
              (surname, first_name, middle_name, suffix, gender, birthday, email, email_verified_at, email_verification_token, email_verification_expires_at, parent_approval_token, contact_number,
               guardian_surname, guardian_first_name, guardian_middle_name, guardian_suffix, relationship_to_guardian,
               street, barangay, city, province, zip_code, referrer_id, referrer_name, relationship_to_referrer, username, password, status) 
              VALUES 
              (:surname, :first_name, :middle_name, :suffix, :gender, :birthday, :email, :email_verified_at, :email_verification_token, :email_verification_expires_at, :parent_approval_token, :contact_number,
               :guardian_surname, :guardian_first_name, :guardian_middle_name, :guardian_suffix, :relationship_to_guardian,
               :street, :barangay, :city, :province, :zip_code, :referrer_id, :referrer_name, :relationship_to_referrer, :username, :password, 'pending')";

    $stmt = $db->prepare($query);

    // Sanitize and bind data
    $surname = htmlspecialchars(strip_tags($data->surname));
    $first_name = htmlspecialchars(strip_tags($data->firstName));
    $middle_name = !empty($data->middleName) ? htmlspecialchars(strip_tags($data->middleName)) : null;
    $suffix = !empty($data->suffix) ? htmlspecialchars(strip_tags($data->suffix)) : 'None';
    $gender = htmlspecialchars(strip_tags($data->gender));
    $birthday = htmlspecialchars(strip_tags($data->birthday));
    $email = htmlspecialchars(strip_tags($data->email));
    $contact_number = !empty($data->contactNumber)
        ? htmlspecialchars(strip_tags($data->contactNumber))
        : null;
    
    // Guardian fields
    $guardian_surname = ($age <= 17 && !empty($data->guardianSurname)) ? htmlspecialchars(strip_tags($data->guardianSurname)) : null;
    $guardian_first_name = ($age <= 17 && !empty($data->guardianFirstName)) ? htmlspecialchars(strip_tags($data->guardianFirstName)) : null;
    $guardian_middle_name = ($age <= 17 && !empty($data->guardianMiddleName)) ? htmlspecialchars(strip_tags($data->guardianMiddleName)) : null;
    $guardian_suffix = ($age <= 17 && !empty($data->guardianSuffix)) ? htmlspecialchars(strip_tags($data->guardianSuffix)) : 'None';
    $relationship_to_guardian = ($age <= 17 && !empty($data->relationshipToGuardian)) ? htmlspecialchars(strip_tags($data->relationshipToGuardian)) : null;
    
    // Address fields
    $street = htmlspecialchars(strip_tags($data->street));
    $barangay = htmlspecialchars(strip_tags($data->barangay));
    $city = htmlspecialchars(strip_tags($data->city));
    $province = htmlspecialchars(strip_tags($data->province));
    $zip_code = htmlspecialchars(strip_tags($data->zipCode));
    if (!preg_match('/^\d{4}$/', $zip_code)) {
        http_response_code(400);
        echo json_encode(["message" => "Please enter a valid 4-digit ZIP code"]);
        exit();
    }
    
    // Referrer fields
    $referrer_id = !empty($data->referrerId) ? intval($data->referrerId) : null;
    $relationship_to_referrer = !empty($data->relationshipToReferrer) ? htmlspecialchars(strip_tags($data->relationshipToReferrer)) : null;
    
    // Fetch referrer name if referrer_id exists
    $referrer_name = null;
    if ($referrer_id) {
        $referrer_query = "SELECT first_name, middle_name, surname, suffix FROM members WHERE id = :referrer_id";
        $referrer_stmt = $db->prepare($referrer_query);
        $referrer_stmt->bindParam(":referrer_id", $referrer_id);
        $referrer_stmt->execute();
        
        if ($referrer_stmt->rowCount() > 0) {
            $referrer = $referrer_stmt->fetch(PDO::FETCH_ASSOC);
            $referrer_name = trim(implode(' ', array_filter([
                $referrer['first_name'],
                !empty($referrer['middle_name']) ? $referrer['middle_name'] : null,
                $referrer['surname'],
                ($referrer['suffix'] != 'None') ? $referrer['suffix'] : null
            ])));
        }
    }
    
    $username = htmlspecialchars(strip_tags($data->username));

    // Validate name fields
    if (!preg_match("/^[A-Za-z][A-Za-z'\- ]*[A-Za-z]$/", $surname) || strlen($surname) < 2) {
        http_response_code(400);
        echo json_encode(["message" => "Please enter a valid surname"]);
        exit();
    }
    
    if (!preg_match("/^[A-Za-z][A-Za-z'\- ]*[A-Za-z]$/", $first_name) || strlen($first_name) < 2) {
        http_response_code(400);
        echo json_encode(["message" => "Please enter a valid first name"]);
        exit();
    }

    // Check if email already exists (excluding rejected members)
    // For minors (17 and below), allow duplicate emails (parent's email)
    // For 18+, check for duplicate emails
    if ($age >= 18) {
        $check_email_query = "SELECT id FROM members WHERE email = :email AND status != 'rejected'";
        $check_email_stmt = $db->prepare($check_email_query);
        $check_email_stmt->bindParam(":email", $email);
        $check_email_stmt->execute();

        if ($check_email_stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(["message" => "Email already exists"]);
            exit();
        }
    }

    // Bind all parameters
    $stmt->bindParam(":surname", $surname);
    $stmt->bindParam(":first_name", $first_name);
    $stmt->bindParam(":middle_name", $middle_name);
    $stmt->bindParam(":suffix", $suffix);
    $stmt->bindParam(":gender", $gender);
    $stmt->bindParam(":birthday", $birthday);
    $stmt->bindParam(":email", $email);
    $stmt->bindValue(":email_verified_at", null, PDO::PARAM_NULL);
    $stmt->bindParam(":email_verification_token", $verificationToken);
    $stmt->bindParam(":email_verification_expires_at", $verificationExpiresAt);
    if ($parentApprovalToken !== null) {
        $stmt->bindParam(":parent_approval_token", $parentApprovalToken);
    } else {
        $stmt->bindValue(":parent_approval_token", null, PDO::PARAM_NULL);
    }
    if ($contact_number !== null) {
        $stmt->bindParam(":contact_number", $contact_number);
    } else {
        $stmt->bindValue(":contact_number", null, PDO::PARAM_NULL);
    }
    $stmt->bindParam(":guardian_surname", $guardian_surname);
    $stmt->bindParam(":guardian_first_name", $guardian_first_name);
    $stmt->bindParam(":guardian_middle_name", $guardian_middle_name);
    $stmt->bindParam(":guardian_suffix", $guardian_suffix);
    $stmt->bindParam(":relationship_to_guardian", $relationship_to_guardian);
    $stmt->bindParam(":street", $street);
    $stmt->bindParam(":barangay", $barangay);
    $stmt->bindParam(":city", $city);
    $stmt->bindParam(":province", $province);
    $stmt->bindParam(":zip_code", $zip_code);
    $stmt->bindParam(":referrer_id", $referrer_id);
    $stmt->bindParam(":referrer_name", $referrer_name);
    $stmt->bindParam(":relationship_to_referrer", $relationship_to_referrer);
    $stmt->bindParam(":username", $username);
    $stmt->bindParam(":password", $hashed_password);

    if ($stmt->execute()) {
        $newMemberId = (int) $db->lastInsertId();
        require_once __DIR__ . '/../family/link_at_registration.php';
        link_family_after_registration($db, $newMemberId, $data->familyLinks ?? null, $age);
        $displayName = trim($first_name . ' ' . $surname);
        
        // For minors, send parent notification instead of regular verification email
        if ($age <= 17) {
            $guardianName = trim(($data->guardianFirstName ?? '') . ' ' . ($data->guardianSurname ?? ''));
            $emailSendResult = sendParentNotificationEmail($db, $email, $displayName, $guardianName, $parentApprovalToken);
        } else {
            // For adults, send regular verification email
            $emailSendResult = sendEmailVerificationLink($db, $email, $displayName, $verificationToken);
        }

        http_response_code(201);
        echo json_encode([
            "message" => "Registration successful. Please verify your email and wait for admin approval.",
            "status" => "pending",
            "email_verification_sent" => $emailSendResult['success'],
            "email_verification_message" => $emailSendResult['message']
        ]);
    } else {
        $errorInfo = $stmt->errorInfo();
        error_log("Database execution error: " . json_encode($errorInfo));
        http_response_code(503);
        echo json_encode([
            "message" => "Unable to complete registration",
            "error" => $errorInfo[2] ?? "Unknown database error"
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Unable to register. Data is incomplete."]);
}
?> 
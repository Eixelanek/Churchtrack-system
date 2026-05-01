<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';

$database = new Database();
$db = $database->getConnection();
ensureEmailVerificationInfrastructure($db);
ensureMemberCreatedViaColumn($db);

$data = json_decode(file_get_contents("php://input"));

// Validate required fields for admin member creation
if (!empty($data->surname) && !empty($data->firstName) && !empty($data->username) && !empty($data->password)) {
    // Sanitize basic fields
    $surname = htmlspecialchars(strip_tags($data->surname));
    $first_name = htmlspecialchars(strip_tags($data->firstName));
    $middle_name = !empty($data->middleName) ? htmlspecialchars(strip_tags($data->middleName)) : null;
    $suffix = !empty($data->suffix) ? htmlspecialchars(strip_tags($data->suffix)) : 'None';
    $gender = !empty($data->gender) ? htmlspecialchars(strip_tags($data->gender)) : 'Prefer not to say';
    $birthday = !empty($data->birthday) ? htmlspecialchars(strip_tags($data->birthday)) : null;
    $email = !empty($data->email) ? htmlspecialchars(strip_tags($data->email)) : null;
    $contact_number = !empty($data->contactNumber) ? htmlspecialchars(strip_tags($data->contactNumber)) : null;
    $street = !empty($data->street) ? htmlspecialchars(strip_tags($data->street)) : null;
    $barangay = !empty($data->barangay) ? htmlspecialchars(strip_tags($data->barangay)) : null;
    $city = !empty($data->city) ? htmlspecialchars(strip_tags($data->city)) : null;
    $province = !empty($data->province) ? htmlspecialchars(strip_tags($data->province)) : null;
    $zip_code = !empty($data->zipCode) ? htmlspecialchars(strip_tags($data->zipCode)) : null;
    $username = htmlspecialchars(strip_tags($data->username));
    $password = $data->password;

    // Check for duplicate username (excluding rejected)
    $check_query = "SELECT id FROM members WHERE username = :username AND status != 'rejected'";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(":username", $username);
    $check_stmt->execute();
    if ($check_stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(["message" => "Username already exists"]);
        exit();
    }

    // Check for duplicate email (excluding rejected)
    if ($email) {
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

    // Hash the password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // Calculate age for guardian validation if birthday is provided
    $guardian_surname = null;
    $guardian_first_name = null;
    $guardian_middle_name = null;
    $guardian_suffix = 'None';
    $relationship_to_guardian = null;
    
    if ($birthday) {
        $birthDate = new DateTime($birthday);
        $today = new DateTime();
        $age = $today->diff($birthDate)->y;
        
        // Handle guardian information for minors
        if ($age <= 17) {
            $guardian_surname = !empty($data->guardianSurname) ? htmlspecialchars(strip_tags($data->guardianSurname)) : null;
            $guardian_first_name = !empty($data->guardianFirstName) ? htmlspecialchars(strip_tags($data->guardianFirstName)) : null;
            $guardian_middle_name = !empty($data->guardianMiddleName) ? htmlspecialchars(strip_tags($data->guardianMiddleName)) : null;
            $guardian_suffix = !empty($data->guardianSuffix) ? htmlspecialchars(strip_tags($data->guardianSuffix)) : 'None';
            $relationship_to_guardian = !empty($data->relationshipToGuardian) ? htmlspecialchars(strip_tags($data->relationshipToGuardian)) : null;
        }
    }

    $verificationToken = null;
    $verificationExpiresAt = null;
    if ($email !== null && trim($email) !== '') {
        $verificationToken = generateEmailVerificationToken();
        $verificationExpiresAt = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');
    }

    $query = "INSERT INTO members 
              (surname, first_name, middle_name, suffix, gender, birthday, email, email_verified_at, email_verification_token, email_verification_expires_at, contact_number,
               guardian_surname, guardian_first_name, guardian_middle_name, guardian_suffix, relationship_to_guardian,
               street, barangay, city, province, zip_code, username, password, status, must_change_password, member_created_via) 
              VALUES 
              (:surname, :first_name, :middle_name, :suffix, :gender, :birthday, :email, :email_verified_at, :email_verification_token, :email_verification_expires_at, :contact_number,
               :guardian_surname, :guardian_first_name, :guardian_middle_name, :guardian_suffix, :relationship_to_guardian,
               :street, :barangay, :city, :province, :zip_code, :username, :password, 'active', 1, 'admin')";
               
    $stmt = $db->prepare($query);
    $stmt->bindParam(":surname", $surname);
    $stmt->bindParam(":first_name", $first_name);
    $stmt->bindParam(":middle_name", $middle_name);
    $stmt->bindParam(":suffix", $suffix);
    $stmt->bindParam(":gender", $gender);
    $stmt->bindParam(":birthday", $birthday);
    if ($email !== null) {
        $stmt->bindParam(":email", $email);
    } else {
        $stmt->bindValue(":email", null, PDO::PARAM_NULL);
    }
    $stmt->bindValue(":email_verified_at", null, PDO::PARAM_NULL);
    if ($verificationToken !== null) {
        $stmt->bindParam(":email_verification_token", $verificationToken);
        $stmt->bindParam(":email_verification_expires_at", $verificationExpiresAt);
    } else {
        $stmt->bindValue(":email_verification_token", null, PDO::PARAM_NULL);
        $stmt->bindValue(":email_verification_expires_at", null, PDO::PARAM_NULL);
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
    $stmt->bindParam(":username", $username);
    $stmt->bindParam(":password", $hashed_password);

    if ($stmt->execute()) {
        $newId = (int)$db->lastInsertId();
        $emailSendNote = null;
        if ($email !== null && trim($email) !== '' && $verificationToken !== null) {
            $displayName = trim($first_name . ' ' . $surname);
            $send = sendEmailVerificationLink($db, $email, $displayName, $verificationToken);
            $emailSendNote = [
                'email_verification_sent' => $send['success'],
                'email_verification_message' => $send['message'] ?? ''
            ];
        }

        http_response_code(201);
        $out = [
            "message" => "Member added successfully.",
            "status" => "active"
        ];
        if ($emailSendNote !== null) {
            $out = array_merge($out, $emailSendNote);
        }
        echo json_encode($out);
    } else {
        http_response_code(503);
        echo json_encode(["message" => "Unable to add member."]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Surname, first name, username, and password are required."]);
}
?>

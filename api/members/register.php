<?php
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

// Auto-cleaning: Delete rejected members older than 30 days
$database = new Database();
$db = $database->getConnection();
$cleanup_query = "DELETE FROM members WHERE status = 'rejected' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
$db->prepare($cleanup_query)->execute();
// Auto-cleaning: Delete expired and used verification codes
$cleanup_codes_query = "DELETE FROM verification_codes WHERE is_used = TRUE OR created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)";
$db->prepare($cleanup_codes_query)->execute();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (
    !empty($data->surname) &&
    !empty($data->firstName) &&
    !empty($data->username) &&
    !empty($data->password) &&
    !empty($data->birthday) &&
    !empty($data->contactNumber) &&
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

    // Insert new member with comprehensive data
    $query = "INSERT INTO members 
              (surname, first_name, middle_name, suffix, gender, birthday, email, contact_number,
               guardian_surname, guardian_first_name, guardian_middle_name, guardian_suffix, relationship_to_guardian,
               street, barangay, city, province, zip_code, referrer_id, referrer_name, relationship_to_referrer, username, password, status) 
              VALUES 
              (:surname, :first_name, :middle_name, :suffix, :gender, :birthday, :email, :contact_number,
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
    $email = isset($data->email) && trim($data->email) !== ''
        ? htmlspecialchars(strip_tags($data->email))
        : null;
    $contact_number = htmlspecialchars(strip_tags($data->contactNumber));
    
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
    if ($email !== null) {
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
    if ($email !== null) {
        $stmt->bindParam(":email", $email);
    } else {
        $stmt->bindValue(":email", null, PDO::PARAM_NULL);
    }
    $stmt->bindParam(":contact_number", $contact_number);
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
        http_response_code(201);
        echo json_encode([
            "message" => "Registration successful. Please wait for admin approval.",
            "status" => "pending"
        ]);
    } else {
        http_response_code(503);
        echo json_encode(["message" => "Unable to complete registration"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Unable to register. Data is incomplete."]);
}
?> 
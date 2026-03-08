<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $data = json_decode(file_get_contents("php://input"));
    
    if (empty($data->guest_id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Guest ID is required']);
        exit();
    }
    
    // Validate required fields
    if (
        empty($data->surname) ||
        empty($data->firstName) ||
        empty($data->username) ||
        empty($data->password) ||
        empty($data->birthday) ||
        empty($data->contactNumber) ||
        empty($data->gender) ||
        empty($data->street) ||
        empty($data->barangay) ||
        empty($data->city) ||
        empty($data->province) ||
        empty($data->zipCode)
    ) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'All required fields must be filled']);
        exit();
    }
    
    $guestId = (int)$data->guest_id;
    
    // Get guest data
    $guestQuery = "SELECT * FROM guests WHERE id = :guest_id LIMIT 1";
    $guestStmt = $db->prepare($guestQuery);
    $guestStmt->bindParam(':guest_id', $guestId, PDO::PARAM_INT);
    $guestStmt->execute();
    $guest = $guestStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$guest) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Guest not found']);
        exit();
    }
    
    // Check if guest is already converted
    if (strtolower($guest['status'] ?? 'active') === 'archived') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Guest has already been converted to member']);
        exit();
    }
    
    // Check if username already exists
    $usernameCheck = $db->prepare("SELECT id FROM members WHERE username = :username AND status != 'rejected'");
    $usernameCheck->bindParam(':username', $data->username);
    $usernameCheck->execute();
    if ($usernameCheck->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username already exists']);
        exit();
    }
    
    // Check if contact number or email already exists in members
    $contactCheck = $db->prepare("SELECT id FROM members WHERE contact_number = :contact_number AND status != 'rejected'");
    $contactCheck->bindParam(':contact_number', $data->contactNumber);
    $contactCheck->execute();
    if ($contactCheck->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Contact number is already registered']);
        exit();
    }
    
    if (!empty($data->email)) {
        $emailCheck = $db->prepare("SELECT id FROM members WHERE email = :email AND email IS NOT NULL AND email != '' AND status != 'rejected'");
        $emailCheck->bindParam(':email', $data->email);
        $emailCheck->execute();
        if ($emailCheck->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email is already registered']);
            exit();
        }
    }
    
    // Hash password
    $hashedPassword = password_hash($data->password, PASSWORD_DEFAULT);
    
    // Calculate age for guardian validation
    $birthDate = new DateTime($data->birthday);
    $today = new DateTime();
    $age = $today->diff($birthDate)->y;
    
    // Validate guardian information for minors (17 and below)
    if ($age <= 17) {
        if (empty($data->guardianSurname) || empty($data->guardianFirstName) || empty($data->relationshipToGuardian)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Guardian information is required for members 17 years old and below']);
            exit();
        }
    }
    
    // Start transaction
    $db->beginTransaction();
    
    try {
        // Use guest data as base, but allow form data to override
        $surname = htmlspecialchars(strip_tags($data->surname ?? $guest['surname']));
        $first_name = htmlspecialchars(strip_tags($data->firstName ?? $guest['first_name']));
        $middle_name = !empty($data->middleName) ? htmlspecialchars(strip_tags($data->middleName)) : ($guest['middle_name'] ?? null);
        $suffix = !empty($data->suffix) ? htmlspecialchars(strip_tags($data->suffix)) : ($guest['suffix'] ?? 'None');
        $gender = htmlspecialchars(strip_tags($data->gender));
        $birthday = htmlspecialchars(strip_tags($data->birthday));
        $email = !empty($data->email) ? htmlspecialchars(strip_tags($data->email)) : ($guest['email'] ?? null);
        $contact_number = htmlspecialchars(strip_tags($data->contactNumber ?? $guest['contact_number']));
        
        // Guardian fields (only for minors)
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
            throw new Exception('Please enter a valid 4-digit ZIP code');
        }
        
        $username = htmlspecialchars(strip_tags($data->username));
        
        // Get referrer info from guest if available
        $referrer_id = !empty($guest['invited_by_member_id']) ? (int)$guest['invited_by_member_id'] : null;
        $referrer_name = null;
        if ($referrer_id) {
            $referrerQuery = "SELECT first_name, middle_name, surname, suffix FROM members WHERE id = :referrer_id";
            $referrerStmt = $db->prepare($referrerQuery);
            $referrerStmt->bindParam(':referrer_id', $referrer_id, PDO::PARAM_INT);
            $referrerStmt->execute();
            if ($referrerStmt->rowCount() > 0) {
                $referrer = $referrerStmt->fetch(PDO::FETCH_ASSOC);
                $referrer_name = trim(implode(' ', array_filter([
                    $referrer['first_name'],
                    !empty($referrer['middle_name']) ? $referrer['middle_name'] : null,
                    $referrer['surname'],
                    ($referrer['suffix'] != 'None') ? $referrer['suffix'] : null
                ])));
            }
        }
        $relationship_to_referrer = !empty($guest['invited_by_text']) ? htmlspecialchars(strip_tags($guest['invited_by_text'])) : null;
        
        // Insert member record with status 'active' (they've already attended 4 times)
        $memberQuery = "INSERT INTO members 
            (surname, first_name, middle_name, suffix, gender, birthday, email, contact_number,
             guardian_surname, guardian_first_name, guardian_middle_name, guardian_suffix, relationship_to_guardian,
             street, barangay, city, province, zip_code, referrer_id, referrer_name, relationship_to_referrer,
             username, password, status, created_at) 
            VALUES 
            (:surname, :first_name, :middle_name, :suffix, :gender, :birthday, :email, :contact_number,
             :guardian_surname, :guardian_first_name, :guardian_middle_name, :guardian_suffix, :relationship_to_guardian,
             :street, :barangay, :city, :province, :zip_code, :referrer_id, :referrer_name, :relationship_to_referrer,
             :username, :password, 'active', NOW())";
        
        $memberStmt = $db->prepare($memberQuery);
        $memberStmt->bindParam(':surname', $surname);
        $memberStmt->bindParam(':first_name', $first_name);
        $memberStmt->bindParam(':middle_name', $middle_name);
        $memberStmt->bindParam(':suffix', $suffix);
        $memberStmt->bindParam(':gender', $gender);
        $memberStmt->bindParam(':birthday', $birthday);
        $memberStmt->bindParam(':email', $email);
        $memberStmt->bindParam(':contact_number', $contact_number);
        $memberStmt->bindParam(':guardian_surname', $guardian_surname);
        $memberStmt->bindParam(':guardian_first_name', $guardian_first_name);
        $memberStmt->bindParam(':guardian_middle_name', $guardian_middle_name);
        $memberStmt->bindParam(':guardian_suffix', $guardian_suffix);
        $memberStmt->bindParam(':relationship_to_guardian', $relationship_to_guardian);
        $memberStmt->bindParam(':street', $street);
        $memberStmt->bindParam(':barangay', $barangay);
        $memberStmt->bindParam(':city', $city);
        $memberStmt->bindParam(':province', $province);
        $memberStmt->bindParam(':zip_code', $zip_code);
        $memberStmt->bindParam(':referrer_id', $referrer_id);
        $memberStmt->bindParam(':referrer_name', $referrer_name);
        $memberStmt->bindParam(':relationship_to_referrer', $relationship_to_referrer);
        $memberStmt->bindParam(':username', $username);
        $memberStmt->bindParam(':password', $hashedPassword);
        
        $memberStmt->execute();
        $memberId = $db->lastInsertId();
        
        // Update guest status to 'archived' (not deleted, to keep history)
        $updateGuestQuery = "UPDATE guests SET status = 'archived', updated_at = NOW() WHERE id = :guest_id";
        $updateGuestStmt = $db->prepare($updateGuestQuery);
        $updateGuestStmt->bindParam(':guest_id', $guestId, PDO::PARAM_INT);
        $updateGuestStmt->execute();
        
        $db->commit();
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Successfully converted to member! Welcome to the church family.',
            'data' => [
                'member_id' => $memberId,
                'guest_id' => $guestId,
                'username' => $username
            ]
        ]);
        
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    error_log("Guest to Member Conversion Error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>


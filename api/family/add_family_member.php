<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (empty($data->primary_member_id) || empty($data->relationship_type) || 
    empty($data->first_name) || empty($data->surname)) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Primary member ID, relationship type, first name, and surname are required"
    ]);
    exit();
}

try {
    // Sanitize inputs
    $primaryMemberId = htmlspecialchars(strip_tags($data->primary_member_id));
    $relationshipType = htmlspecialchars(strip_tags($data->relationship_type));
    $firstName = htmlspecialchars(strip_tags($data->first_name));
    $middleName = !empty($data->middle_name) ? htmlspecialchars(strip_tags($data->middle_name)) : null;
    $surname = htmlspecialchars(strip_tags($data->surname));
    $suffix = !empty($data->suffix) ? htmlspecialchars(strip_tags($data->suffix)) : 'None';
    $gender = !empty($data->gender) ? htmlspecialchars(strip_tags($data->gender)) : null;
    $birthday = !empty($data->birthday) ? $data->birthday : null;
    $contactNumber = !empty($data->contact_number) ? htmlspecialchars(strip_tags($data->contact_number)) : null;
    $email = !empty($data->email) ? htmlspecialchars(strip_tags($data->email)) : null;
    
    // Validate relationship type
    $validRelationships = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other'];
    if (!in_array($relationshipType, $validRelationships)) {
        http_response_code(400);
        echo json_encode([
            "error" => true,
            "message" => "Invalid relationship type"
        ]);
        exit();
    }
    
    // Check if primary member exists
    $checkQuery = "SELECT id FROM members WHERE id = :member_id";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':member_id', $primaryMemberId);
    $checkStmt->execute();
    
    if ($checkStmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "error" => true,
            "message" => "Primary member not found"
        ]);
        exit();
    }
    
    // Insert family member
    $query = "INSERT INTO family_members 
              (primary_member_id, relationship_type, first_name, middle_name, surname, suffix, 
               gender, birthday, contact_number, email)
              VALUES 
              (:primary_member_id, :relationship_type, :first_name, :middle_name, :surname, :suffix,
               :gender, :birthday, :contact_number, :email)";
    
    $stmt = $db->prepare($query);
    
    $stmt->bindParam(':primary_member_id', $primaryMemberId);
    $stmt->bindParam(':relationship_type', $relationshipType);
    $stmt->bindParam(':first_name', $firstName);
    $stmt->bindParam(':middle_name', $middleName);
    $stmt->bindParam(':surname', $surname);
    $stmt->bindParam(':suffix', $suffix);
    $stmt->bindParam(':gender', $gender);
    $stmt->bindParam(':birthday', $birthday);
    $stmt->bindParam(':contact_number', $contactNumber);
    $stmt->bindParam(':email', $email);
    
    if ($stmt->execute()) {
        $familyMemberId = $db->lastInsertId();
        
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Family member added successfully",
            "family_member_id" => $familyMemberId
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "error" => true,
            "message" => "Failed to add family member"
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error adding family member: " . $e->getMessage()
    ]);
}
?>

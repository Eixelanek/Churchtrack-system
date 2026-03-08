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

$input = json_decode(file_get_contents("php://input"));

if (empty($input->id) || empty($input->manager_status)) {
    http_response_code(400);
    echo json_encode(["message" => "Member id and manager_status are required."]);
    exit();
}

$validStatuses = ['pending', 'approved', 'rejected'];
if (!in_array($input->manager_status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid manager_status value."]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $check = $db->prepare("SHOW COLUMNS FROM members LIKE 'manager_status'");
    $check->execute();
    if ($check->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN manager_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER status, ADD COLUMN manager_reviewed_at DATETIME NULL AFTER manager_status, ADD COLUMN manager_note TEXT NULL AFTER manager_reviewed_at");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to ensure manager review columns exist."]);
    exit();
}

try {
    $rejectionColCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'rejection_reason'");
    $rejectionColCheck->execute();
    if ($rejectionColCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN rejection_reason TEXT NULL AFTER status");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to ensure rejection_reason column exists."]);
    exit();
}

$managerStatus = $input->manager_status;
$managerNote = isset($input->manager_note) ? trim($input->manager_note) : null;

if ($managerStatus === 'rejected' && ($managerNote === null || $managerNote === '')) {
    http_response_code(400);
    echo json_encode(["message" => "manager_note is required when manager_status is rejected."]);
    exit();
}

$additionalClauses = '';
if ($managerStatus === 'rejected') {
    $additionalClauses = ",
              status = 'rejected',
              rejection_reason = :rejection_reason";
}

$query = "UPDATE members
          SET manager_status = :manager_status,
              manager_reviewed_at = NOW(),
              manager_note = :manager_note,
              updated_at = NOW()" . $additionalClauses . "
          WHERE id = :id";

$stmt = $db->prepare($query);
$stmt->bindParam(':manager_status', $managerStatus);

if ($managerNote !== null && $managerNote !== '') {
    $sanitizedNote = htmlspecialchars($managerNote, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $stmt->bindParam(':manager_note', $sanitizedNote);
} else {
    $sanitizedNote = null;
    $stmt->bindValue(':manager_note', null, PDO::PARAM_NULL);
}

$stmt->bindParam(':id', $input->id);

if ($managerStatus === 'rejected') {
    $rejectionReason = $sanitizedNote ?? '';
    $stmt->bindParam(':rejection_reason', $rejectionReason);
}

if ($stmt->execute()) {
    echo json_encode([
        "message" => "Manager review status updated successfully.",
        "manager_status" => $managerStatus
    ]);
} else {
    http_response_code(503);
    echo json_encode(["message" => "Unable to update manager review status."]);
}
?>

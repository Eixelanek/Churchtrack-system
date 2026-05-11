<?php
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);

    $data = json_decode(file_get_contents("php://input"));

    if (empty($data->token)) {
        http_response_code(400);
        echo json_encode(["message" => "Approval token is required"]);
        exit();
    }

    $token = $data->token;

    // Find member with this parent approval token
    $query = "SELECT id, email, first_name, surname, email_verified_at, parent_approval_expires_at FROM members WHERE parent_approval_token = :token LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(":token", $token);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid or expired approval token"]);
        exit();
    }

    $member = $stmt->fetch(PDO::FETCH_ASSOC);
    $memberId = $member['id'];

    // Check if token has expired
    if ($member['parent_approval_expires_at'] !== null) {
        $expiresAt = new DateTime($member['parent_approval_expires_at']);
        $now = new DateTime();
        if ($now > $expiresAt) {
            http_response_code(400);
            echo json_encode(["message" => "Approval token has expired. Please contact the church administrator to request a new registration link."]);
            exit();
        }
    }

    // Check if already approved
    if ($member['email_verified_at'] !== null) {
        http_response_code(200);
        echo json_encode([
            "message" => "This registration has already been approved by parent",
            "already_approved" => true
        ]);
        exit();
    }

    // Mark email as verified and clear the parent approval token
    $updateQuery = "UPDATE members SET email_verified_at = NOW(), parent_approval_token = NULL WHERE id = :id";
    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->bindParam(":id", $memberId);

    if ($updateStmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "message" => "Parent approval successful. Email verified.",
            "member_name" => trim($member['first_name'] . ' ' . $member['surname']),
            "success" => true
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Failed to process approval"]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?>

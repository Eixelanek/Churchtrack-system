<?php
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

include_once '../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);

    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
    if ($token === '') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Verification token is required."
        ]);
        exit();
    }

    $query = "SELECT id, email_verified_at, email_verification_expires_at
              FROM members
              WHERE email_verification_token = :token
              LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':token', $token);
    $stmt->execute();
    $member = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid verification link."
        ]);
        exit();
    }

    if (!empty($member['email_verified_at'])) {
        echo json_encode([
            "success" => true,
            "message" => "Email is already verified."
        ]);
        exit();
    }

    $expiresAt = $member['email_verification_expires_at'];
    if ($expiresAt) {
        $expiryDate = new DateTime($expiresAt);
        $now = new DateTime();
        if ($expiryDate < $now) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Verification link has expired. Please register again or request a new verification link."
            ]);
            exit();
        }
    }

    $update = $db->prepare("UPDATE members
                            SET email_verified_at = NOW(),
                                email_verification_token = NULL,
                                email_verification_expires_at = NULL,
                                updated_at = NOW()
                            WHERE id = :id");
    $update->bindParam(':id', $member['id'], PDO::PARAM_INT);
    $update->execute();

    echo json_encode([
        "success" => true,
        "message" => "Email verified successfully. You can now log in once your account is approved."
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}


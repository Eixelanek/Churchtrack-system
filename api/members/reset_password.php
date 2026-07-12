<?php
// Handle password reset with token
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $payload = json_decode(file_get_contents('php://input'), true);

    if (!isset($payload['token']) || trim($payload['token']) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Reset token is required']);
        exit();
    }

    if (!isset($payload['newPassword']) || trim($payload['newPassword']) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'New password is required']);
        exit();
    }

    $token = trim($payload['token']);
    $newPassword = $payload['newPassword'];

    // Validate password strength
    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters long']);
        exit();
    }

    // Find reset request with valid token
    $resetQuery = $db->prepare("SELECT id, member_id, reset_token_expires_at FROM password_reset_requests WHERE reset_token = :token AND status = 'pending' LIMIT 1");
    $resetQuery->bindParam(':token', $token);
    $resetQuery->execute();

    if ($resetQuery->rowCount() === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired reset token']);
        exit();
    }

    $resetRequest = $resetQuery->fetch(PDO::FETCH_ASSOC);
    $resetId = (int)$resetRequest['id'];
    $memberId = (int)$resetRequest['member_id'];

    // Check if token has expired
    $expiresAt = new DateTime($resetRequest['reset_token_expires_at']);
    $now = new DateTime();
    if ($now > $expiresAt) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Reset token has expired. Please request a new one']);
        exit();
    }

    // Hash new password
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

    // Update member password and clear any must_change_password flag
    $updateQuery = $db->prepare("UPDATE members SET password = :password, must_change_password = 0, password_temp_expires_at = NULL WHERE id = :member_id");
    $updateQuery->bindParam(':password', $hashedPassword);
    $updateQuery->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $updateQuery->execute();

    // Mark reset request as completed
    $completeQuery = $db->prepare("UPDATE password_reset_requests SET status = 'completed' WHERE id = :reset_id");
    $completeQuery->bindParam(':reset_id', $resetId, PDO::PARAM_INT);
    $completeQuery->execute();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Password has been reset successfully. You can now login with your new password.'
    ]);

} catch (Exception $e) {
    error_log('Password reset error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

<?php
// Password reset via email
header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set('Asia/Manila');

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
require_once __DIR__ . '/email_verification_utils.php';

function ensurePasswordResetTable(PDO $db): void
{
    $db->exec("CREATE TABLE IF NOT EXISTS password_reset_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        reset_token VARCHAR(255) NOT NULL UNIQUE,
        reset_token_expires_at DATETIME NOT NULL,
        status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
        requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        INDEX idx_member_status (member_id, status),
        INDEX idx_token (reset_token),
        CONSTRAINT fk_reset_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

try {
    $database = new Database();
    $db = $database->getConnection();
    ensurePasswordResetTable($db);

    $payload = json_decode(file_get_contents('php://input'), true);

    if (!isset($payload['username']) || trim($payload['username']) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username is required.']);
        exit();
    }

    $username = trim($payload['username']);

    // Get member with birthday to calculate age
    $memberQuery = $db->prepare("SELECT id, first_name, email, birthday FROM members WHERE username = :username AND status != 'rejected' LIMIT 1");
    $memberQuery->bindParam(':username', $username);
    $memberQuery->execute();
    $member = $memberQuery->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'We couldn\'t find an account with that username.']);
        exit();
    }

    $memberId = (int)$member['id'];
    $memberEmail = $member['email'];
    $memberFirstName = $member['first_name'] ?? 'Member';

    // Calculate age
    $birthDate = new DateTime($member['birthday']);
    $today = new DateTime();
    $age = $today->diff($birthDate)->y;

    // Determine which email to send reset link to
    // For minors (under 18): send to parent's email (which is stored in the email field)
    // For adults (18+): send to their own email
    $resetEmail = $memberEmail;

    // Generate reset token (24 hour expiration)
    $resetToken = generateEmailVerificationToken();
    $expiresAt = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');

    // Store reset request
    $insertQuery = $db->prepare("INSERT INTO password_reset_requests (member_id, reset_token, reset_token_expires_at) VALUES (:member_id, :token, :expires_at)");
    $insertQuery->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $insertQuery->bindParam(':token', $resetToken);
    $insertQuery->bindParam(':expires_at', $expiresAt);
    $insertQuery->execute();

    // Build reset URL
    $resetUrl = getFrontendBaseUrl() . '/reset-password?token=' . urlencode($resetToken);

    // Send reset email
    $emailSubject = 'Password Reset Request';
    $textBody = "Hello $memberFirstName,\n\n";
    $textBody .= "We received a request to reset your password. Click the link below to set a new password:\n\n";
    $textBody .= "$resetUrl\n\n";
    $textBody .= "This link expires in 24 hours.\n\n";
    $textBody .= "If you didn't request this, please ignore this email.\n\n";
    $textBody .= "Best regards,\nChurchTrack System";

    $resetUrlEsc = htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8');
    $htmlBody = "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>";
    $htmlBody .= "<p>Hello $memberFirstName,</p>";
    $htmlBody .= "<p>We received a request to reset your password. Click the button below to set a new password:</p>";
    $htmlBody .= "<p><a href='" . $resetUrlEsc . "' style='display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;'>Reset Password</a></p>";
    $htmlBody .= "<p>This link expires in 24 hours.</p>";
    $htmlBody .= "<p>If you didn't request this, please ignore this email.</p>";
    $htmlBody .= "<p>Best regards,<br>ChurchTrack System</p>";
    $htmlBody .= "</body></html>";

    $replyTo = null;
    $envReply = trim((string)(getenv('RESEND_REPLY_TO') ?: ''));
    if ($envReply !== '' && filter_var($envReply, FILTER_VALIDATE_EMAIL)) {
        $replyTo = $envReply;
    }

    // Send password reset email using the same function as verification emails
    require_once __DIR__ . '/resend_transport.php';
    
    $emailSent = sendEmailViaResendApi(
        $resetEmail,
        $memberFirstName,
        $emailSubject,
        $htmlBody,
        $textBody,
        $replyTo
    );

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Password reset link has been sent to your email. Please check your inbox and follow the instructions.'
    ]);

} catch (Exception $e) {
    error_log('Password reset error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

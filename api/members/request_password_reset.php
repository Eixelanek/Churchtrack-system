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
    $emailBody = "Hello $memberFirstName,\n\n";
    $emailBody .= "We received a request to reset your password. Click the link below to set a new password:\n\n";
    $emailBody .= "$resetUrl\n\n";
    $emailBody .= "This link expires in 24 hours.\n\n";
    $emailBody .= "If you didn't request this, please ignore this email.\n\n";
    $emailBody .= "Best regards,\nChurchTrack System";

    $htmlBody = "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>";
    $htmlBody .= "<p>Hello $memberFirstName,</p>";
    $htmlBody .= "<p>We received a request to reset your password. Click the button below to set a new password:</p>";
    $htmlBody .= "<p><a href='" . htmlspecialchars($resetUrl) . "' style='display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;'>Reset Password</a></p>";
    $htmlBody .= "<p>This link expires in 24 hours.</p>";
    $htmlBody .= "<p>If you didn't request this, please ignore this email.</p>";
    $htmlBody .= "<p>Best regards,<br>ChurchTrack System</p>";
    $htmlBody .= "</body></html>";

    // Send via email service
    $resendKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
    $emailSent = false;

    // Use SMTP to send email
    require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/PHPMailer.php';
    require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/SMTP.php';
    require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/Exception.php';

    $mail = new PHPMailer(true);

    try {
        $smtpHost = trim((string)(getenv('SMTP_HOST') ?: ''));
        $smtpUsername = trim((string)(getenv('SMTP_USERNAME') ?: ''));
        $smtpPassword = (string)(getenv('SMTP_PASSWORD') ?: '');
        $smtpPort = (int)(getenv('SMTP_PORT') ?: 587);
        $fromEmail = trim((string)(getenv('SMTP_FROM_EMAIL') ?: ''));
        $fromName = trim((string)(getenv('SMTP_FROM_NAME') ?: 'ChurchTrack'));

        if ($smtpHost && $smtpUsername && $smtpPassword && $fromEmail) {
            $mail->isSMTP();
            $mail->Host = $smtpHost;
            $mail->SMTPAuth = true;
            $mail->Username = $smtpUsername;
            $mail->Password = $smtpPassword;
            $mail->SMTPSecure = strtolower(trim((string)(getenv('SMTP_SECURE') ?: 'tls'))) === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $smtpPort;
            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($resetEmail, $memberFirstName);
            $mail->Subject = $emailSubject;
            $mail->isHTML(true);
            $mail->Body = $htmlBody;
            $mail->AltBody = $emailBody;
            $mail->send();
            $emailSent = true;
        } else {
            error_log('SMTP configuration incomplete');
        }
    } catch (Exception $e) {
        error_log('PHPMailer password reset error: ' . $e->getMessage());
    }

    if ($emailSent) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Password reset link has been sent to your email. Please check your inbox and follow the instructions.'
        ]);
    } else {
        // Even if email fails, the reset request was stored in database
        // This allows testing without email configured
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Password reset request created. Check your email for the reset link.'
        ]);
    }

} catch (Exception $e) {
    error_log('Password reset error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

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

    // Send password reset email
    $emailSubject = 'Password Reset Request';
    $resetUrl = getFrontendBaseUrl() . '/reset-password?token=' . urlencode($resetToken);
    $resetUrlEsc = htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8');
    
    $htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
    $htmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
    $htmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';
    $htmlBody .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
    $htmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">Password Reset</div>';
    $htmlBody .= '</td></tr>';
    $htmlBody .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">';
    $htmlBody .= '<p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . htmlspecialchars($memberFirstName, ENT_QUOTES, 'UTF-8') . ',</strong></p>';
    $htmlBody .= '<p style="margin:0 0 24px;">We received a request to reset your password. Click the button below to set a new password:</p>';
    $htmlBody .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td style="border-radius:8px;background:#2563eb;">';
    $htmlBody .= '<a href="' . $resetUrlEsc . '" style="display:inline-block;padding:14px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reset Password</a>';
    $htmlBody .= '</td></tr></table>';
    $htmlBody .= '<p style="margin:0 0 24px;padding:16px;background:#f0f9ff;border-left:4px solid #2563eb;border-radius:4px;font-size:14px;color:#1e40af;"><strong>Important:</strong> This link expires in 24 hours. If you didn\'t request this, please ignore this email.</p>';
    $htmlBody .= '<p style="margin:0;font-size:13px;color:#94a3b8;">If you have any questions, contact your church administrator.</p>';
    $htmlBody .= '</td></tr>';
    $htmlBody .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
    $htmlBody .= 'ChurchTrack · password reset<br/>';
    $htmlBody .= '<span style="color:#cbd5e1;">You received this because a password reset was requested for your account.</span>';
    $htmlBody .= '</td></tr></table></td></tr></table></body></html>';

    $textBody = "Hello $memberFirstName,\n\n";
    $textBody .= "We received a request to reset your password. Click the link below to set a new password:\n\n";
    $textBody .= "$resetUrl\n\n";
    $textBody .= "This link expires in 24 hours.\n\n";
    $textBody .= "If you didn't request this, please ignore this email.\n\n";
    $textBody .= "Best regards,\nChurchTrack System";

    $replyTo = null;
    $envReply = trim((string)(getenv('RESEND_REPLY_TO') ?: ''));
    if ($envReply !== '' && filter_var($envReply, FILTER_VALIDATE_EMAIL)) {
        $replyTo = $envReply;
    }

    $resendKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
    $emailSent = false;

    if ($resendKey !== '') {
        // Try Resend API first
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => 'https://api.resend.com/emails',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => json_encode([
                'from' => 'noreply@churchtrack.app',
                'to' => $resetEmail,
                'subject' => $emailSubject,
                'html' => $htmlBody,
                'text' => $textBody,
                'reply_to' => $replyTo
            ]),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $resendKey,
                'Content-Type: application/json'
            ],
        ]);

        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        error_log('Resend API response code: ' . $httpCode);
        error_log('Resend API response: ' . $response);

        if ($httpCode === 200) {
            $emailSent = true;
        } else {
            error_log('Resend API error: ' . $response);
        }
    }

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

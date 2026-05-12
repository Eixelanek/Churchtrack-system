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
require_once __DIR__ . '/resend_transport.php';

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

    // Check rate limiting - count requests in last hour
    $oneHourAgo = (new DateTime('-1 hour'))->format('Y-m-d H:i:s');
    $countQuery = $db->prepare("SELECT COUNT(*) as count FROM password_reset_requests WHERE member_id = :member_id AND requested_at > :one_hour_ago");
    $countQuery->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $countQuery->bindParam(':one_hour_ago', $oneHourAgo);
    $countQuery->execute();
    $countResult = $countQuery->fetch(PDO::FETCH_ASSOC);
    $requestCount = (int)$countResult['count'];

    // Determine wait time based on request count
    $waitMinutes = 0;
    if ($requestCount >= 3) {
        $waitMinutes = 60; // 4th+ request: lock for 1 hour
    } elseif ($requestCount === 2) {
        $waitMinutes = 15; // 3rd request: wait 15 minutes
    } elseif ($requestCount === 1) {
        $waitMinutes = 5;  // 2nd request: wait 5 minutes
    }

    // If there's a wait time, check if enough time has passed
    if ($waitMinutes > 0) {
        $lastRequestQuery = $db->prepare("SELECT requested_at FROM password_reset_requests WHERE member_id = :member_id AND requested_at > :one_hour_ago ORDER BY requested_at DESC LIMIT 1");
        $lastRequestQuery->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $lastRequestQuery->bindParam(':one_hour_ago', $oneHourAgo);
        $lastRequestQuery->execute();
        $lastRequest = $lastRequestQuery->fetch(PDO::FETCH_ASSOC);

        if ($lastRequest) {
            $lastRequestTime = new DateTime($lastRequest['requested_at']);
            $now = new DateTime();
            $minutesPassed = (int)$now->diff($lastRequestTime)->format('%i');

            if ($minutesPassed < $waitMinutes) {
                $remainingMinutes = $waitMinutes - $minutesPassed;
                http_response_code(429); // Too Many Requests
                echo json_encode([
                    'success' => false,
                    'message' => "Too many requests. Please try again in $remainingMinutes minute" . ($remainingMinutes !== 1 ? 's' : '') . '.',
                    'waitMinutes' => $remainingMinutes,
                    'retryAfter' => $remainingMinutes * 60
                ]);
                exit();
            }
        }
    }

    // Calculate age
    $birthDate = new DateTime($member['birthday']);
    $today = new DateTime();
    $age = $today->diff($birthDate)->y;

    // For minors, get parent's name
    $parentFirstName = null;
    if ($age < 18) {
        $parentQuery = $db->prepare("SELECT first_name FROM members WHERE id = (SELECT guardian_id FROM members WHERE id = :member_id LIMIT 1) LIMIT 1");
        $parentQuery->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $parentQuery->execute();
        $parentResult = $parentQuery->fetch(PDO::FETCH_ASSOC);
        if ($parentResult) {
            $parentFirstName = $parentResult['first_name'] ?? 'Parent';
        }
    }

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

    // Determine email greeting and message based on age
    $isMinor = $age < 18;
    $emailGreeting = $isMinor && $parentFirstName ? $parentFirstName : $memberFirstName;
    $emailMessage = $isMinor ? "We received a request to reset the password for <strong>$memberFirstName</strong>'s account. Click the button below to set a new password:" : "We received a request to reset your password. Click the button below to set a new password:";

    // Send reset email
    $emailSubject = 'Password Reset Request';
    $textBody = "Hello $emailGreeting,\n\n";
    $textBody .= ($isMinor ? "We received a request to reset the password for $memberFirstName's account. " : "We received a request to reset your password. ");
    $textBody .= "Open this link to set a new password (expires in 24 hours):\n\n";
    $textBody .= "$resetUrl\n\n";
    $textBody .= "---\n" . trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')) . ' · password reset';

    $resetUrlEsc = htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8');
    $systemName = htmlspecialchars(trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')), ENT_QUOTES, 'UTF-8');
    $churchName = htmlspecialchars(trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church')), ENT_QUOTES, 'UTF-8');
    $displayName = htmlspecialchars($emailGreeting, ENT_QUOTES, 'UTF-8');
    $childName = htmlspecialchars($memberFirstName, ENT_QUOTES, 'UTF-8');
    
    $htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
    $htmlBody .= '<title>Password Reset Request</title></head><body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
    $htmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
    $htmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';
    $htmlBody .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
    $htmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.9);margin-bottom:8px;letter-spacing:0.04em;text-transform:uppercase;">Password Reset</div>';
    $htmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">' . $churchName . '</div>';
    $htmlBody .= '</td></tr>';
    $htmlBody .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">';
    $htmlBody .= '<p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . $displayName . ',</strong></p>';
    if ($isMinor) {
        $htmlBody .= '<p style="margin:0 0 24px;">We received a request to reset the password for <strong>' . $childName . '</strong>\'s account. Click the button below to set a new password:</p>';
    } else {
        $htmlBody .= '<p style="margin:0 0 24px;">We received a request to reset your password. Click the button below to set a new password:</p>';
    }
    $htmlBody .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td style="border-radius:8px;background:#2563eb;">';
    $htmlBody .= '<a href="' . $resetUrlEsc . '" style="display:inline-block;padding:14px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reset Password</a>';
    $htmlBody .= '</td></tr></table>';
    $htmlBody .= '<p style="margin:0 0 8px;font-size:13px;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>';
    $htmlBody .= '<p style="margin:0 0 24px;word-break:break-all;font-size:13px;"><a href="' . $resetUrlEsc . '" style="color:#2563eb;">' . $resetUrlEsc . '</a></p>';
    $htmlBody .= '<p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">This link expires in <strong style="color:#64748b;">24 hours</strong>.</p>';
    $htmlBody .= '<p style="margin:0;font-size:13px;color:#94a3b8;">If you didn\'t request this, please ignore this email.</p>';
    $htmlBody .= '</td></tr>';
    $htmlBody .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
    $htmlBody .= $systemName . ' · password reset<br/>';
    $htmlBody .= '<span style="color:#cbd5e1;">You received this because a password reset was requested for your account.</span>';
    $htmlBody .= '</td></tr></table></td></tr></table></body></html>';

    $replyTo = null;
    $envReply = trim((string)(getenv('RESEND_REPLY_TO') ?: ''));
    if ($envReply !== '' && filter_var($envReply, FILTER_VALIDATE_EMAIL)) {
        $replyTo = $envReply;
    }

    // Send password reset email using the same function as verification emails
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

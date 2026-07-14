<?php
/**
 * Sends the member's personal QR code by email.
 * Called internally after admin/manager approves a member.
 * Can also be called standalone (e.g., resend).
 *
 * Standalone POST body: { member_id, session_id, admin_id }
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once __DIR__ . '/resend_transport.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';

if (!function_exists('generateAndEnsureQrToken')) {
    function generateAndEnsureQrToken(PDO $db, int $memberId): string
    {
        // Fetch existing token
        $stmt = $db->prepare("SELECT qr_token FROM members WHERE id = :id LIMIT 1");
        $stmt->bindValue(':id', $memberId, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!empty($row['qr_token'])) {
            return $row['qr_token'];
        }

        // Generate a new one
        $token = bin2hex(random_bytes(32));
        $upd = $db->prepare("UPDATE members SET qr_token = :token WHERE id = :id");
        $upd->bindValue(':token', $token);
        $upd->bindValue(':id', $memberId, PDO::PARAM_INT);
        $upd->execute();

        return $token;
    }
}

if (!function_exists('buildQrEmailHtml')) {
    function buildQrEmailHtml(
        array $branding,
        string $memberName,
        string $qrImageUrl,
        string $qrToken,
        string $frontendUrl
    ): string {
        $churchName   = htmlspecialchars($branding['churchName'], ENT_QUOTES, 'UTF-8');
        $nameEsc      = htmlspecialchars($memberName, ENT_QUOTES, 'UTF-8');
        $logoSrc      = resolveEmailLogoSrc($branding['logoSrc'] ?? null);
        $systemName   = htmlspecialchars(
            trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')),
            ENT_QUOTES, 'UTF-8'
        );
        $qrImgEsc     = htmlspecialchars($qrImageUrl, ENT_QUOTES, 'UTF-8');
        $dashboardUrl = htmlspecialchars(rtrim($frontendUrl, '/') . '/member', ENT_QUOTES, 'UTF-8');

        $html  = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
        $html .= '<title>Your Personal QR Code</title></head>';
        $html .= '<body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
        $html .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
        $html .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';

        // Header
        $html .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
        $html .= '<img src="' . $logoSrc . '" alt="" width="72" height="72" style="display:inline-block;width:72px;height:72px;border-radius:12px;object-fit:contain;background:rgba(255,255,255,0.95);padding:8px;border:1px solid rgba(255,255,255,0.4);" />';
        $html .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.9);margin-top:12px;letter-spacing:0.04em;text-transform:uppercase;">' . $systemName . '</div>';
        $html .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;line-height:1.3;">' . $churchName . '</div>';
        $html .= '</td></tr>';

        // Body
        $html .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">';
        $html .= '<p style="margin:0 0 8px;font-size:18px;color:#0f172a;"><strong>Welcome, ' . $nameEsc . '! 🎉</strong></p>';
        $html .= '<p style="margin:0 0 24px;">Your membership has been approved. Here is your personal QR code — keep it safe and present it to the staff at the entrance every service to mark your attendance.</p>';

        // QR code image block
        $html .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;text-align:center;">';
        $html .= '<tr><td style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:16px;padding:20px;">';
        $html .= '<img src="' . $qrImgEsc . '" alt="Your Personal QR Code" width="220" height="220" style="display:block;width:220px;height:220px;" />';
        $html .= '<p style="margin:12px 0 0;font-size:13px;font-weight:600;color:#64748b;letter-spacing:0.02em;">Personal Attendance QR</p>';
        $html .= '<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">' . $nameEsc . '</p>';
        $html .= '</td></tr></table>';

        // Tip box
        $html .= '<div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:6px;padding:14px 16px;margin-bottom:24px;">';
        $html .= '<p style="margin:0;font-size:14px;color:#1e40af;"><strong>How to use:</strong> Show this QR code (or open it on your phone) to the church staff at the entrance. They will scan it to record your attendance instantly.</p>';
        $html .= '</div>';

        // Dashboard button
        $html .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td style="border-radius:8px;background:#2563eb;">';
        $html .= '<a href="' . $dashboardUrl . '" style="display:inline-block;padding:14px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View Your Dashboard</a>';
        $html .= '</td></tr></table>';

        $html .= '<p style="margin:0;font-size:13px;color:#94a3b8;">You can also view your QR code anytime by logging in and going to <strong>My QR Code</strong> in the member dashboard.</p>';
        $html .= '</td></tr>';

        // Footer
        $html .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
        $html .= $systemName . ' · membership<br/>';
        $html .= '<span style="color:#cbd5e1;">You received this because your membership was approved.</span>';
        $html .= '</td></tr></table></td></tr></table></body></html>';

        return $html;
    }
}

if (!function_exists('buildQrEmailText')) {
    function buildQrEmailText(array $branding, string $memberName, string $qrImageUrl, string $frontendUrl): string
    {
        $text  = strip_tags($branding['churchName']) . " — Your Personal QR Code\n\n";
        $text .= 'Welcome, ' . $memberName . "!\n\n";
        $text .= "Your membership has been approved. Your personal QR code is attached below.\n\n";
        $text .= "How to use: Show this QR code to the church staff at the entrance each service. They will scan it to record your attendance.\n\n";
        $text .= "QR Code image: " . $qrImageUrl . "\n\n";
        $text .= "You can also view your QR code anytime by logging in to:\n";
        $text .= rtrim($frontendUrl, '/') . "/member\n\n";
        $text .= "---\n" . strip_tags(trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack'))) . ' · membership';
        return $text;
    }
}

/**
 * Main function — generates QR token (if needed), builds email, sends it.
 * Returns ['success' => bool, 'message' => string]
 */
if (!function_exists('sendMemberQrEmail')) {
    function sendMemberQrEmail(PDO $db, int $memberId): array
    {
        // Fetch member
        $stmt = $db->prepare(
            "SELECT id, first_name, surname, email, status, email_verified_at, qr_token
             FROM members WHERE id = :id LIMIT 1"
        );
        $stmt->bindValue(':id', $memberId, PDO::PARAM_INT);
        $stmt->execute();
        $member = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$member) {
            return ['success' => false, 'message' => 'Member not found.'];
        }

        $email = trim((string)($member['email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'message' => 'Member has no valid email address.'];
        }

        if (empty($member['email_verified_at'])) {
            return ['success' => false, 'message' => 'Member email is not verified yet.'];
        }

        if ($member['status'] !== 'active') {
            return ['success' => false, 'message' => 'Member is not active yet.'];
        }

        // Ensure QR token exists
        $qrToken = generateAndEnsureQrToken($db, $memberId);

        $memberName   = trim($member['first_name'] . ' ' . $member['surname']);
        $frontendUrl  = getFrontendBaseUrl();
        $branding     = fetchChurchEmailBranding($db);

        // Use QR server API to generate the QR image URL (inline in the email)
        $qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='
            . urlencode($qrToken) . '&margin=2&format=png';

        $htmlBody = buildQrEmailHtml($branding, $memberName, $qrImageUrl, $qrToken, $frontendUrl);
        $textBody = buildQrEmailText($branding, $memberName, $qrImageUrl, $frontendUrl);

        $subject   = $branding['churchName'] . ' — Your Personal Attendance QR Code';
        $replyTo   = $branding['replyToEmail'] ?? null;
        $envReply  = trim((string)(getenv('RESEND_REPLY_TO') ?: ''));
        if (($replyTo === null || $replyTo === '') && $envReply !== '' && filter_var($envReply, FILTER_VALIDATE_EMAIL)) {
            $replyTo = $envReply;
        }

        // Try Resend first
        $resendKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
        if ($resendKey !== '') {
            $result = sendEmailViaResendApi($email, $memberName, $subject, $htmlBody, $textBody, $replyTo);
            if ($result['success']) {
                error_log("QR email sent via Resend to member {$memberId} ({$email})");
                return $result;
            }
            error_log('Resend QR email failed: ' . ($result['message'] ?? 'unknown'));
        }

        // Fallback: SMTP via PHPMailer
        require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/PHPMailer.php';
        require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/SMTP.php';
        require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/Exception.php';

        $smtpHost     = trim((string)(getenv('SMTP_HOST') ?: ''));
        $smtpUser     = trim((string)(getenv('SMTP_USERNAME') ?: ''));
        $smtpPass     = (string)(getenv('SMTP_PASSWORD') ?: '');
        $smtpPort     = (int)(getenv('SMTP_PORT') ?: 587);
        $fromEmail    = trim((string)(getenv('SMTP_FROM_EMAIL') ?: ''));
        $fromName     = trim((string)(getenv('SMTP_FROM_NAME') ?: 'ChurchTrack'));
        $secure       = strtolower(trim((string)(getenv('SMTP_SECURE') ?: 'tls')));

        if ($smtpHost === '' || $smtpUser === '' || $smtpPass === '' || $fromEmail === '') {
            return ['success' => false, 'message' => 'Email service not configured. Add RESEND_API_KEY or SMTP_* env vars.'];
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = $smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = $smtpUser;
            $mail->Password   = $smtpPass;
            $mail->Port       = $smtpPort;
            $mail->SMTPSecure = $secure === 'ssl'
                ? PHPMailer::ENCRYPTION_SMTPS
                : PHPMailer::ENCRYPTION_STARTTLS;
            $mail->CharSet    = 'UTF-8';
            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($email, $memberName);
            if ($replyTo !== null && $replyTo !== '') {
                $mail->addReplyTo($replyTo);
            }
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlBody;
            $mail->AltBody = $textBody;
            $mail->send();

            error_log("QR email sent via SMTP to member {$memberId} ({$email})");
            return ['success' => true, 'message' => 'QR code email sent successfully.'];
        } catch (PHPMailerException $e) {
            error_log('PHPMailer QR email failed: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to send QR email: ' . $e->getMessage()];
        }
    }
}

// ── Standalone endpoint (for manual resend) ───────────────────
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
    header('Content-Type: application/json; charset=UTF-8');

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        exit();
    }

    $data      = json_decode(file_get_contents('php://input'), true);
    $memberId  = isset($data['member_id']) ? (int)$data['member_id'] : 0;
    $sessionId = isset($data['session_id']) ? trim($data['session_id']) : '';
    $adminId   = isset($data['admin_id']) ? (int)$data['admin_id'] : 0;

    if ($memberId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'member_id is required']);
        exit();
    }

    try {
        $database = new Database();
        $db = $database->getConnection();

        // Validate admin/manager session if provided
        if ($adminId > 0 && $sessionId !== '') {
            $sStmt = $db->prepare(
                "SELECT is_active FROM admin_sessions WHERE session_id = :sid AND admin_id = :aid LIMIT 1"
            );
            $sStmt->bindValue(':sid', $sessionId);
            $sStmt->bindValue(':aid', $adminId, PDO::PARAM_INT);
            $sStmt->execute();
            $sRow = $sStmt->fetch(PDO::FETCH_ASSOC);
            if (!$sRow || !(bool)$sRow['is_active']) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Session invalid or expired.']);
                exit();
            }
        }

        $result = sendMemberQrEmail($db, $memberId);
        http_response_code($result['success'] ? 200 : 400);
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
    }
}
?>

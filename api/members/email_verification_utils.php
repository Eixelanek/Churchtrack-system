<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once __DIR__ . '/resend_transport.php';

if (!function_exists('ensureEmailVerificationInfrastructure')) {
    function ensureEmailVerificationInfrastructure(PDO $db): void
    {
        $requiredColumns = [
            'email_verified_at' => "ALTER TABLE members ADD COLUMN email_verified_at DATETIME NULL AFTER email",
            'email_verification_token' => "ALTER TABLE members ADD COLUMN email_verification_token VARCHAR(128) NULL AFTER email_verified_at",
            'email_verification_expires_at' => "ALTER TABLE members ADD COLUMN email_verification_expires_at DATETIME NULL AFTER email_verification_token"
        ];

        foreach ($requiredColumns as $column => $alterSql) {
            $checkStmt = $db->prepare("SHOW COLUMNS FROM members LIKE :column_name");
            $checkStmt->bindParam(':column_name', $column);
            if ($checkStmt->execute() && $checkStmt->rowCount() === 0) {
                $db->exec($alterSql);
            }
        }
    }
}

if (!function_exists('generateEmailVerificationToken')) {
    function generateEmailVerificationToken(): string
    {
        return bin2hex(random_bytes(32));
    }
}

if (!function_exists('getFrontendBaseUrl')) {
    function getFrontendBaseUrl(): string
    {
        $configured = getenv('FRONTEND_URL');
        if ($configured && trim($configured) !== '') {
            return rtrim(trim($configured), '/');
        }

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '') {
            return rtrim($origin, '/');
        }

        return 'https://localhost:5173';
    }
}

if (!function_exists('fetchChurchEmailBranding')) {
    /**
     * @return array{churchName: string, replyToEmail: ?string, logoSrc: ?string}
     */
    function fetchChurchEmailBranding(PDO $db): array
    {
        $defaultName = trim((string)(getenv('CHURCH_DISPLAY_NAME') ?: 'Christ-Like Christian Church'));

        try {
            $check = $db->query("SHOW TABLES LIKE 'church_settings'");
            if ($check === false || $check->rowCount() === 0) {
                return [
                    'churchName' => $defaultName,
                    'replyToEmail' => null,
                    'logoSrc' => null,
                ];
            }

            $stmt = $db->query(
                "SELECT church_name, church_email, church_logo, header_logo FROM church_settings ORDER BY id LIMIT 1"
            );
            $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
            if (!$row) {
                return [
                    'churchName' => $defaultName,
                    'replyToEmail' => null,
                    'logoSrc' => null,
                ];
            }

            $name = trim((string)($row['church_name'] ?? ''));
            if ($name === '') {
                $name = $defaultName;
            }

            $reply = trim((string)($row['church_email'] ?? ''));
            $replyToEmail = ($reply !== '' && filter_var($reply, FILTER_VALIDATE_EMAIL)) ? $reply : null;

            $logoSrc = null;
            foreach (['header_logo', 'church_logo'] as $col) {
                $val = $row[$col] ?? null;
                if (!is_string($val) || trim($val) === '') {
                    continue;
                }
                $val = trim($val);
                if (strlen($val) > 120000) {
                    continue;
                }
                if (strpos($val, 'http://') === 0 || strpos($val, 'https://') === 0 || strpos($val, 'data:image') === 0) {
                    $logoSrc = $val;
                    break;
                }
            }

            return [
                'churchName' => $name,
                'replyToEmail' => $replyToEmail,
                'logoSrc' => $logoSrc,
            ];
        } catch (Exception $e) {
            error_log('fetchChurchEmailBranding failed: ' . $e->getMessage());
            return [
                'churchName' => $defaultName,
                'replyToEmail' => null,
                'logoSrc' => null,
            ];
        }
    }
}

if (!function_exists('resolveEmailLogoSrc')) {
    function resolveEmailLogoSrc(?string $dbLogoSrc): string
    {
        $envUrl = trim((string)(getenv('EMAIL_BRANDING_LOGO_URL') ?: ''));
        if ($envUrl !== '') {
            return htmlspecialchars($envUrl, ENT_QUOTES, 'UTF-8');
        }
        if (is_string($dbLogoSrc) && $dbLogoSrc !== '') {
            return htmlspecialchars($dbLogoSrc, ENT_QUOTES, 'UTF-8');
        }

        return htmlspecialchars(getFrontendBaseUrl() . '/email-logo.png', ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('buildVerificationEmailContent')) {
    /**
     * @param array{churchName: string, replyToEmail: ?string, logoSrc: ?string} $branding
     * @return array{subject: string, html: string, text: string}
     */
    function buildVerificationEmailContent(array $branding, string $recipientDisplayName, string $verificationUrl): array
    {
        $churchName = htmlspecialchars($branding['churchName'], ENT_QUOTES, 'UTF-8');
        $displayName = htmlspecialchars($recipientDisplayName, ENT_QUOTES, 'UTF-8');
        $verifyEsc = htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8');
        $logoSrc = resolveEmailLogoSrc($branding['logoSrc'] ?? null);
        $systemName = htmlspecialchars(
            trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')),
            ENT_QUOTES,
            'UTF-8'
        );

        $subject = $churchName . ' — verify your email';

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
        $html .= '<title>' . htmlspecialchars($subject, ENT_QUOTES, 'UTF-8') . '</title></head><body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
        $html .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
        $html .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';
        $html .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
        $html .= '<img src="' . $logoSrc . '" alt="" width="72" height="72" style="display:inline-block;width:72px;height:72px;border-radius:12px;object-fit:contain;background:rgba(255,255,255,0.95);padding:8px;border:1px solid rgba(255,255,255,0.4);" />';
        $html .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.9);margin-top:12px;letter-spacing:0.04em;text-transform:uppercase;">' . $systemName . '</div>';
        $html .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;line-height:1.3;">' . $churchName . '</div>';
        $html .= '</td></tr>';
        $html .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">';
        $html .= '<p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . $displayName . ',</strong></p>';
        $html .= '<p style="margin:0 0 24px;">Thanks for registering. Please confirm your email address to continue. Admin approval still applies before you can sign in.</p>';
        $html .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td style="border-radius:8px;background:#2563eb;">';
        $html .= '<a href="' . $verifyEsc . '" style="display:inline-block;padding:14px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Verify email address</a>';
        $html .= '</td></tr></table>';
        $html .= '<p style="margin:0 0 8px;font-size:13px;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>';
        $html .= '<p style="margin:0 0 24px;word-break:break-all;font-size:13px;"><a href="' . $verifyEsc . '" style="color:#2563eb;">' . $verifyEsc . '</a></p>';
        $html .= '<p style="margin:0;font-size:13px;color:#94a3b8;">This link expires in <strong style="color:#64748b;">24 hours</strong>.</p>';
        $html .= '</td></tr>';
        $html .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
        $html .= $systemName . ' · membership registration<br/>';
        $html .= '<span style="color:#cbd5e1;">You received this because someone registered with your email address.</span>';
        $html .= '</td></tr></table></td></tr></table></body></html>';

        $text = strip_tags($branding['churchName']) . " — verify your email\n\n";
        $text .= 'Hello ' . $recipientDisplayName . ",\n\n";
        $text .= "Thanks for registering. Open this link to verify your email (expires in 24 hours):\n\n";
        $text .= $verificationUrl . "\n\n";
        $text .= "---\n" . strip_tags(trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack'))) . ' · membership registration';

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }
}

if (!function_exists('sendEmailVerificationLink')) {
    function sendEmailVerificationLink(PDO $db, string $recipientEmail, string $recipientName, string $token): array
    {
        $verificationUrl = getFrontendBaseUrl() . '/verify-email?token=' . urlencode($token);
        $displayName = trim($recipientName) !== '' ? $recipientName : $recipientEmail;

        $branding = fetchChurchEmailBranding($db);
        $built = buildVerificationEmailContent($branding, $displayName, $verificationUrl);
        $subject = $built['subject'];
        $htmlBody = $built['html'];
        $textBody = $built['text'];
        $replyTo = $branding['replyToEmail'] ?? null;
        $envReply = trim((string)(getenv('RESEND_REPLY_TO') ?: ''));
        if (($replyTo === null || $replyTo === '') && $envReply !== '' && filter_var($envReply, FILTER_VALIDATE_EMAIL)) {
            $replyTo = $envReply;
        }

        $resendKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
        $resendResult = null;
        if ($resendKey !== '') {
            $resendResult = sendEmailViaResendApi($recipientEmail, $displayName, $subject, $htmlBody, $textBody, $replyTo);
            if ($resendResult['success']) {
                return $resendResult;
            }
            error_log('Resend verification failed: ' . ($resendResult['message'] ?? 'unknown'));
        }

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
            $secure = strtolower(trim((string)(getenv('SMTP_SECURE') ?: 'tls')));
            $smtpDebug = strtolower(trim((string)(getenv('SMTP_DEBUG') ?: 'false')));
            $frontendUrl = getFrontendBaseUrl();

            if ($smtpHost === '' || $smtpUsername === '' || $smtpPassword === '' || $fromEmail === '') {
                if ($resendResult !== null) {
                    return [
                        'success' => false,
                        'message' => 'Verification email failed. Resend error: ' . ($resendResult['message'] ?? 'unknown'),
                    ];
                }
                return [
                    'success' => false,
                    'message' => 'Email not configured: add RESEND_API_KEY on Render (recommended) or SMTP_* variables.',
                ];
            }

            error_log(sprintf(
                'Email verification SMTP attempt host=%s port=%d secure=%s user=%s from=%s frontend=%s recipient=%s',
                $smtpHost,
                $smtpPort,
                $secure,
                $smtpUsername,
                $fromEmail,
                $frontendUrl,
                $recipientEmail
            ));

            $mail->isSMTP();
            $mail->Host = $smtpHost;
            $mail->SMTPAuth = true;
            $mail->Username = $smtpUsername;
            $mail->Password = $smtpPassword;
            $mail->Port = $smtpPort;
            $mail->Timeout = 20;
            $mail->SMTPKeepAlive = false;

            if (in_array($smtpDebug, ['1', 'true', 'yes'], true)) {
                $mail->SMTPDebug = 2;
                $mail->Debugoutput = static function ($str, $level) {
                    error_log('PHPMailer SMTP debug [' . $level . ']: ' . $str);
                };
            }

            if ($secure === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } else {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }

            $mail->CharSet = 'UTF-8';
            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($recipientEmail, $displayName);
            if ($replyTo !== null && $replyTo !== '') {
                $mail->addReplyTo($replyTo, $branding['churchName']);
            }
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            $mail->AltBody = $textBody;
            $mail->send();

            return ['success' => true, 'message' => 'Verification email sent.'];
        } catch (PHPMailerException $e) {
            error_log('Email verification send failed: ' . $e->getMessage());
            $smtpMsg = 'SMTP failed: ' . $e->getMessage();
            if ($resendResult !== null && empty($resendResult['success'])) {
                return [
                    'success' => false,
                    'message' => $smtpMsg . ' | Resend: ' . ($resendResult['message'] ?? 'unknown'),
                ];
            }
            return ['success' => false, 'message' => 'Unable to send verification email right now.'];
        }
    }
}

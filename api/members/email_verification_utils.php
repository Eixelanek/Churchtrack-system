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

if (!function_exists('sendEmailVerificationLink')) {
    function sendEmailVerificationLink(string $recipientEmail, string $recipientName, string $token): array
    {
        $verificationUrl = getFrontendBaseUrl() . '/verify-email?token=' . urlencode($token);
        $displayName = trim($recipientName) !== '' ? $recipientName : $recipientEmail;
        $subject = 'Verify your email address';

        $htmlBody = sprintf(
            '<p>Hello %s,</p><p>Thanks for registering. Please verify your email by clicking the button below:</p><p><a href="%s" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p><p>If the button does not work, copy and paste this link into your browser:<br>%s</p><p>This verification link expires in 24 hours.</p>',
            htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8')
        );
        $textBody = "Hello {$displayName},\n\nPlease verify your email by opening this link:\n{$verificationUrl}\n\nThis verification link expires in 24 hours.";

        $resendKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
        $resendResult = null;
        if ($resendKey !== '') {
            $resendResult = sendEmailViaResendApi($recipientEmail, $displayName, $subject, $htmlBody, $textBody);
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

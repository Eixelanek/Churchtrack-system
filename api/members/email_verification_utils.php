<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

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
        require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/PHPMailer.php';
        require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/SMTP.php';
        require_once __DIR__ . '/../../vendor/phpmailer/phpmailer/src/Exception.php';

        $verificationUrl = getFrontendBaseUrl() . '/verify-email?token=' . urlencode($token);
        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host = getenv('SMTP_HOST') ?: 'sandbox.smtp.mailtrap.io';
            $mail->SMTPAuth = true;
            $mail->Username = getenv('SMTP_USERNAME') ?: '6d9592f68fe27b';
            $mail->Password = getenv('SMTP_PASSWORD') ?: 'b66f2375c2b4db';
            $mail->Port = (int)(getenv('SMTP_PORT') ?: 2525);

            $secure = getenv('SMTP_SECURE');
            if ($secure === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } else {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }

            $fromEmail = getenv('SMTP_FROM_EMAIL') ?: 'noreply@yourdomain.com';
            $fromName = getenv('SMTP_FROM_NAME') ?: 'ChurchTrack';
            $displayName = trim($recipientName) !== '' ? $recipientName : $recipientEmail;

            $mail->CharSet = 'UTF-8';
            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($recipientEmail, $displayName);
            $mail->isHTML(true);
            $mail->Subject = 'Verify your email address';
            $mail->Body = sprintf(
                '<p>Hello %s,</p><p>Thanks for registering. Please verify your email by clicking the button below:</p><p><a href="%s" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p><p>If the button does not work, copy and paste this link into your browser:<br>%s</p><p>This verification link expires in 24 hours.</p>',
                htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8')
            );
            $mail->AltBody = "Hello {$displayName},\n\nPlease verify your email by opening this link:\n{$verificationUrl}\n\nThis verification link expires in 24 hours.";
            $mail->send();

            return ['success' => true, 'message' => 'Verification email sent.'];
        } catch (PHPMailerException $e) {
            error_log('Email verification send failed: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Unable to send verification email right now.'];
        }
    }
}


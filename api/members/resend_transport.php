<?php

/**
 * Sends transactional email via Resend HTTPS API (avoids SMTP port blocking on some hosts).
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

if (!function_exists('sendEmailViaResendApi')) {
    function sendEmailViaResendApi(
        string $toEmail,
        string $recipientDisplayName,
        string $subject,
        string $htmlBody,
        string $textBody
    ): array {
        $apiKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
        if ($apiKey === '') {
            return ['success' => false, 'message' => 'RESEND_API_KEY is not set.'];
        }

        $fromEmail = trim((string)(getenv('RESEND_FROM_EMAIL') ?: ''));
        if ($fromEmail === '') {
            $fromEmail = 'onboarding@resend.dev';
        }

        $fromName = trim((string)(getenv('RESEND_FROM_NAME') ?: getenv('SMTP_FROM_NAME') ?: 'ChurchTrack'));
        $fromHeader = $fromName !== '' ? sprintf('%s <%s>', $fromName, $fromEmail) : $fromEmail;

        $payload = [
            'from' => $fromHeader,
            'to' => [$toEmail],
            'subject' => $subject,
            'html' => $htmlBody,
            'text' => $textBody,
        ];

        $body = json_encode($payload);
        if ($body === false) {
            return ['success' => false, 'message' => 'Unable to encode email payload.'];
        }

        error_log(sprintf(
            'Email verification Resend attempt from=%s to=%s subject=%s',
            $fromHeader,
            $toEmail,
            $subject
        ));

        $ch = curl_init('https://api.resend.com/emails');
        if ($ch === false) {
            return ['success' => false, 'message' => 'Unable to initialise HTTP client for email send.'];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            error_log('Resend CURL error: ' . $curlErr);
            return ['success' => false, 'message' => 'Unable to reach email provider.'];
        }

        $decoded = json_decode((string)$response, true);
        if ($httpCode >= 200 && $httpCode < 300) {
            return ['success' => true, 'message' => 'Verification email sent.'];
        }

        $errDetail = '';
        if (is_array($decoded)) {
            if (isset($decoded['message'])) {
                $errDetail = is_string($decoded['message']) ? $decoded['message'] : json_encode($decoded['message']);
            } elseif (isset($decoded['errors'])) {
                $errDetail = json_encode($decoded['errors']);
            }
        }

        error_log(sprintf('Resend API error HTTP %s body=%s', (string)$httpCode, substr((string)$response, 0, 500)));

        return [
            'success' => false,
            'message' => $errDetail !== '' ? ('Email provider error: ' . $errDetail) : ('Email provider rejected request (HTTP ' . $httpCode . ').'),
        ];
    }
}

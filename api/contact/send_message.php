<?php
// Contact form submission handler
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
require_once __DIR__ . '/../members/email_verification_utils.php';
require_once __DIR__ . '/../members/resend_transport.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $payload = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $firstName = trim($payload['firstName'] ?? '');
    $lastName = trim($payload['lastName'] ?? '');
    $email = trim($payload['email'] ?? '');
    $phone = trim($payload['phone'] ?? '');
    $message = trim($payload['message'] ?? '');

    if (!$firstName) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'First name is required.']);
        exit();
    }

    if (!$lastName) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Last name is required.']);
        exit();
    }

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid email is required.']);
        exit();
    }

    // Validate email domain against whitelist
    $allowedDomains = [
        'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
        'icloud.com', 'mail.com', 'protonmail.com', 'tutanota.com',
        'yandex.com', 'mail.ru', 'qq.com', 'sina.com', 'sohu.com',
        '163.com', '126.com', 'yeah.net', 'foxmail.com',
        'live.com', 'msn.com', 'bellsouth.net', 'verizon.net',
        'comcast.net', 'cox.net', 'charter.net', 'earthlink.net',
        'sbcglobal.net', 'att.net', 'windstream.net', 'frontier.com',
        'gmail.ph', 'yahoo.com.ph', 'yahoo.ph', 'hotmail.com.ph',
        'clcc.life', 'clcc.site'
    ];

    $emailDomain = strtolower(substr(strrchr($email, "@"), 1));
    if (!in_array($emailDomain, $allowedDomains)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please use a valid email provider (Gmail, Yahoo, Outlook, etc.).']);
        exit();
    }

    if (!$message) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Message is required.']);
        exit();
    }

    // Get client IP
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ipAddress = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
    }

    // Store message in database
    $insertQuery = $db->prepare("INSERT INTO contact_messages (first_name, last_name, email, phone, message, ip_address) VALUES (:first_name, :last_name, :email, :phone, :message, :ip_address)");
    $insertQuery->bindParam(':first_name', $firstName);
    $insertQuery->bindParam(':last_name', $lastName);
    $insertQuery->bindParam(':email', $email);
    $insertQuery->bindParam(':phone', $phone);
    $insertQuery->bindParam(':message', $message);
    $insertQuery->bindParam(':ip_address', $ipAddress);
    $insertQuery->execute();

    $messageId = $db->lastInsertId();

    // Send confirmation email to user
    $confirmationSubject = 'We received your message';
    $confirmationTextBody = "Hello $firstName,\n\n";
    $confirmationTextBody .= "Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.\n\n";
    $confirmationTextBody .= "---\n" . trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack'));

    $churchName = htmlspecialchars(trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church')), ENT_QUOTES, 'UTF-8');
    $displayName = htmlspecialchars($firstName, ENT_QUOTES, 'UTF-8');

    $confirmationHtmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
    $confirmationHtmlBody .= '<title>Message Received</title></head><body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
    $confirmationHtmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
    $confirmationHtmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';
    $confirmationHtmlBody .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
    $confirmationHtmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.9);margin-bottom:8px;letter-spacing:0.04em;text-transform:uppercase;">Message Received</div>';
    $confirmationHtmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">' . $churchName . '</div>';
    $confirmationHtmlBody .= '</td></tr>';
    $confirmationHtmlBody .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">';
    $confirmationHtmlBody .= '<p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . $displayName . ',</strong></p>';
    $confirmationHtmlBody .= '<p style="margin:0 0 24px;">Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.</p>';
    $confirmationHtmlBody .= '<p style="margin:0;font-size:13px;color:#94a3b8;">If you have any urgent concerns, please call us directly.</p>';
    $confirmationHtmlBody .= '</td></tr>';
    $confirmationHtmlBody .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
    $confirmationHtmlBody .= trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')) . '<br/>';
    $confirmationHtmlBody .= '<span style="color:#cbd5e1;">Thank you for contacting us.</span>';
    $confirmationHtmlBody .= '</td></tr></table></td></tr></table></body></html>';

    $replyTo = null;
    $envReply = trim((string)(getenv('RESEND_REPLY_TO') ?: ''));
    if ($envReply !== '' && filter_var($envReply, FILTER_VALIDATE_EMAIL)) {
        $replyTo = $envReply;
    }

    // Send confirmation to user
    sendEmailViaResendApi(
        $email,
        $firstName,
        $confirmationSubject,
        $confirmationHtmlBody,
        $confirmationTextBody,
        $replyTo
    );

    // Send notification email to admin (testing phase: churchtrack.system@gmail.com)
    $adminEmail = 'churchtrack.system@gmail.com';
    $adminSubject = 'New Contact Message from ' . $firstName . ' ' . $lastName;
    
    $adminTextBody = "New contact message received:\n\n";
    $adminTextBody .= "Name: $firstName $lastName\n";
    $adminTextBody .= "Email: $email\n";
    $adminTextBody .= "Phone: " . ($phone ?: 'Not provided') . "\n";
    $adminTextBody .= "Message:\n$message\n\n";
    $adminTextBody .= "---\n" . trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack'));

    $messageEsc = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $emailEsc = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
    $phoneEsc = htmlspecialchars($phone ?: 'Not provided', ENT_QUOTES, 'UTF-8');
    $fullNameEsc = htmlspecialchars("$firstName $lastName", ENT_QUOTES, 'UTF-8');

    $adminHtmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
    $adminHtmlBody .= '<title>New Contact Message</title></head><body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
    $adminHtmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
    $adminHtmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';
    $adminHtmlBody .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
    $adminHtmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.9);margin-bottom:8px;letter-spacing:0.04em;text-transform:uppercase;">New Contact Message</div>';
    $adminHtmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">' . $churchName . '</div>';
    $adminHtmlBody .= '</td></tr>';
    $adminHtmlBody .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#334155;">';
    $adminHtmlBody .= '<p style="margin:0 0 20px;"><strong>From:</strong> ' . $fullNameEsc . '</p>';
    $adminHtmlBody .= '<p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:' . $emailEsc . '" style="color:#2563eb;">' . $emailEsc . '</a></p>';
    $adminHtmlBody .= '<p style="margin:0 0 20px;"><strong>Phone:</strong> ' . $phoneEsc . '</p>';
    $adminHtmlBody .= '<div style="background:#f8fafc;padding:16px;border-radius:8px;margin:20px 0;">';
    $adminHtmlBody .= '<p style="margin:0 0 8px;"><strong>Message:</strong></p>';
    $adminHtmlBody .= '<p style="margin:0;white-space:pre-wrap;color:#475569;">' . $messageEsc . '</p>';
    $adminHtmlBody .= '</div>';
    $adminHtmlBody .= '</td></tr>';
    $adminHtmlBody .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
    $adminHtmlBody .= trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')) . '<br/>';
    $adminHtmlBody .= '<span style="color:#cbd5e1;">Message ID: ' . $messageId . '</span>';
    $adminHtmlBody .= '</td></tr></table></td></tr></table></body></html>';

    // Send notification to admin
    sendEmailViaResendApi(
        $adminEmail,
        'Admin',
        $adminSubject,
        $adminHtmlBody,
        $adminTextBody,
        $replyTo
    );

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Thank you for your message! We will get back to you soon.'
    ]);

} catch (Exception $e) {
    error_log('Contact message error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

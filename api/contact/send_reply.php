<?php
// Send reply to contact message
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

    if (!isset($payload['message_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Message ID is required']);
        exit();
    }

    if (!isset($payload['reply_text']) || trim($payload['reply_text']) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Reply text is required']);
        exit();
    }

    $messageId = (int)$payload['message_id'];
    $replyText = trim($payload['reply_text']);

    // Get the original message
    $messageQuery = $db->prepare("SELECT first_name, last_name, email FROM contact_messages WHERE id = :id");
    $messageQuery->bindParam(':id', $messageId, PDO::PARAM_INT);
    $messageQuery->execute();

    if ($messageQuery->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Message not found']);
        exit();
    }

    $message = $messageQuery->fetch(PDO::FETCH_ASSOC);
    $recipientEmail = $message['email'];
    $recipientName = $message['first_name'];
    $senderName = $message['first_name'] . ' ' . $message['last_name'];

    // Send reply email
    $emailSubject = 'Re: Your Message to ' . trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church'));
    
    $textBody = "Hello $recipientName,\n\n";
    $textBody .= "Thank you for contacting us. Here is our response to your message:\n\n";
    $textBody .= "---\n\n";
    $textBody .= "$replyText\n\n";
    $textBody .= "---\n\n";
    $textBody .= "Best regards,\n";
    $textBody .= trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church')) . "\n";
    $textBody .= trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack'));

    $churchName = htmlspecialchars(trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church')), ENT_QUOTES, 'UTF-8');
    $displayName = htmlspecialchars($recipientName, ENT_QUOTES, 'UTF-8');
    $replyTextEsc = htmlspecialchars($replyText, ENT_QUOTES, 'UTF-8');
    $replyTextFormatted = nl2br($replyTextEsc);

    $htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
    $htmlBody .= '<title>Reply to Your Message</title></head><body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">';
    $htmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">';
    $htmlBody .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">';
    $htmlBody .= '<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 24px;text-align:center;">';
    $htmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.9);margin-bottom:8px;letter-spacing:0.04em;text-transform:uppercase;">Reply to Your Message</div>';
    $htmlBody .= '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">' . $churchName . '</div>';
    $htmlBody .= '</td></tr>';
    $htmlBody .= '<tr><td style="padding:32px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">';
    $htmlBody .= '<p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . $displayName . ',</strong></p>';
    $htmlBody .= '<p style="margin:0 0 24px;">Thank you for contacting us. Here is our response to your message:</p>';
    $htmlBody .= '<div style="background:#f8fafc;padding:20px;border-left:4px solid #2563eb;border-radius:4px;margin:20px 0;">';
    $htmlBody .= '<p style="margin:0;color:#475569;line-height:1.6;white-space:pre-wrap;">' . $replyTextFormatted . '</p>';
    $htmlBody .= '</div>';
    $htmlBody .= '<p style="margin:0;font-size:13px;color:#94a3b8;">If you have any further questions, feel free to contact us again.</p>';
    $htmlBody .= '</td></tr>';
    $htmlBody .= '<tr><td style="padding:16px 28px 28px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">';
    $htmlBody .= trim((string)(getenv('EMAIL_SYSTEM_NAME') ?: 'ChurchTrack')) . '<br/>';
    $htmlBody .= '<span style="color:#cbd5e1;">© ' . date('Y') . ' ' . $churchName . '. All rights reserved.</span>';
    $htmlBody .= '</td></tr></table></td></tr></table></body></html>';

    // Send from noreply@clcc.site
    $fromEmail = 'noreply@clcc.site';
    
    $emailSent = sendEmailViaResendApi(
        $recipientEmail,
        $recipientName,
        $emailSubject,
        $htmlBody,
        $textBody,
        $fromEmail
    );

    // Update message status to 'replied'
    $updateQuery = $db->prepare("UPDATE contact_messages SET status = 'replied' WHERE id = :id");
    $updateQuery->bindParam(':id', $messageId, PDO::PARAM_INT);
    $updateQuery->execute();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Reply sent successfully'
    ]);

} catch (Exception $e) {
    error_log('Send reply error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

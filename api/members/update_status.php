<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';
require_once __DIR__ . '/resend_transport.php';
require_once __DIR__ . '/email_verification_utils.php';
require_once __DIR__ . '/send_qr_email.php';

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id) || empty($data->status)) {
    http_response_code(400);
    echo json_encode(["message" => "Unable to update status. Data is incomplete."]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Ensure rejection_reason column exists
try {
    $colCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'rejection_reason'");
    $colCheck->execute();
    if ($colCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN rejection_reason TEXT NULL AFTER status");
    }
} catch (Exception $e) {}

// Ensure manager review columns exist
try {
    $managerCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'manager_status'");
    $managerCheck->execute();
    if ($managerCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN manager_status ENUM('pending','recommended','not_recommended','rejected') NOT NULL DEFAULT 'pending' AFTER status, ADD COLUMN manager_reviewed_at DATETIME NULL AFTER manager_status, ADD COLUMN manager_recommendation_note TEXT NULL AFTER manager_reviewed_at");
    }
} catch (Exception $e) {}

$valid_statuses = ['pending', 'active', 'rejected', 'inactive'];
if (!in_array($data->status, $valid_statuses)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid status"]);
    exit();
}

$rejectionReason = null;
if ($data->status === 'rejected') {
    $rejectionReason = isset($data->reason) ? trim($data->reason) : '';
    if ($rejectionReason === '') {
        http_response_code(400);
        echo json_encode(["message" => "Rejection reason is required."]);
        exit();
    }
}

$query = "UPDATE members 
          SET status = :status,
              rejection_reason = :rejection_reason,
              updated_at = NOW()
          WHERE id = :id";

$stmt = $db->prepare($query);
$stmt->bindParam(":status", $data->status);
if ($rejectionReason !== null) {
    $stmt->bindParam(":rejection_reason", $rejectionReason);
} else {
    $stmt->bindValue(":rejection_reason", null, PDO::PARAM_NULL);
}
$stmt->bindParam(":id", $data->id);

if (!$stmt->execute()) {
    http_response_code(503);
    echo json_encode(["message" => "Unable to update member status"]);
    exit();
}

// Fetch member email and name
$fetchStmt = $db->prepare("SELECT email, full_name AS name FROM members WHERE id = :id");
$fetchStmt->bindParam(":id", $data->id);
$fetchStmt->execute();
$member = $fetchStmt->fetch(PDO::FETCH_ASSOC);

// Cleanup old rejected members
if ($data->status === 'rejected') {
    $cleanupStmt = $db->prepare("DELETE FROM members WHERE status = 'rejected' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY) AND id != :current_id");
    $cleanupStmt->bindParam(":current_id", $data->id);
    $cleanupStmt->execute();
}

// Send rejection email only — approval email is the QR email sent below
if ($member && !empty($member['email']) && $data->status === 'rejected') {
    $orgName     = htmlspecialchars(trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church')), ENT_QUOTES, 'UTF-8');
    $displayName = htmlspecialchars($member['name'], ENT_QUOTES, 'UTF-8');
    $subject     = 'Your membership request was not approved';
    $reasonText  = $rejectionReason ? "Reason: {$rejectionReason}\n\n" : '';
    $textBody    = "Hello {$member['name']},\n\nThank you for your interest. After careful review, your membership request was not approved.\n\n{$reasonText}If you have questions, feel free to contact us.\n\nBest regards,\n" . strip_tags($orgName);
    $reasonHtml  = $rejectionReason ? '<p style="margin:0 0 16px;background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b;"><strong>Reason:</strong> ' . htmlspecialchars($rejectionReason) . '</p>' : '';
    $htmlBody    = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 24px;text-align:center;">
        <div style="font-size:13px;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Membership Update</div>
        <div style="font-size:20px;font-weight:700;color:#fff;">' . $orgName . '</div>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
        <p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . $displayName . ',</strong></p>
        <p style="margin:0 0 16px;">Thank you for your interest in joining ' . $orgName . '. After careful review, we regret to inform you that your membership request was not approved at this time.</p>
        ' . $reasonHtml . '
        <p style="margin:0;">If you have any questions, feel free to reach out to us.</p>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">' . $orgName . '</td></tr>
        </table></td></tr></table></body></html>';

    sendEmailViaResendApi($member['email'], $member['name'], $subject, $htmlBody, $textBody);
}

// Send QR email on activation — sendMemberQrEmail checks email_verified_at internally
// so it won't send if email is not yet verified
if ($data->status === 'active') {
    $qrSend = sendMemberQrEmail($db, (int)$data->id);
    if (!$qrSend['success']) {
        error_log("QR email failed for member {$data->id}: " . ($qrSend['message'] ?? 'unknown'));
    }
}

echo json_encode([
    "message" => "Member status updated successfully",
    "status"  => $data->status,
    "reason"  => $rejectionReason
]);
?>

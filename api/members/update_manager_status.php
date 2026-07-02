<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$input = json_decode(file_get_contents("php://input"));

if (empty($input->id) || empty($input->manager_status)) {
    http_response_code(400);
    echo json_encode(["message" => "Member id and manager_status are required."]);
    exit();
}

$validStatuses = ['pending', 'approved', 'rejected'];
if (!in_array($input->manager_status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid manager_status value."]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $check = $db->prepare("SHOW COLUMNS FROM members LIKE 'manager_status'");
    $check->execute();
    if ($check->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN manager_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER status, ADD COLUMN manager_reviewed_at DATETIME NULL AFTER manager_status, ADD COLUMN manager_note TEXT NULL AFTER manager_reviewed_at");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to ensure manager review columns exist."]);
    exit();
}

try {
    $rejectionColCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'rejection_reason'");
    $rejectionColCheck->execute();
    if ($rejectionColCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN rejection_reason TEXT NULL AFTER status");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to ensure rejection_reason column exists."]);
    exit();
}

$managerStatus = $input->manager_status;
$managerNote = isset($input->manager_note) ? trim($input->manager_note) : null;

if ($managerStatus === 'rejected' && ($managerNote === null || $managerNote === '')) {
    http_response_code(400);
    echo json_encode(["message" => "manager_note is required when manager_status is rejected."]);
    exit();
}

$additionalClauses = '';
if ($managerStatus === 'rejected') {
    $additionalClauses = ",
              status = 'rejected',
              rejection_reason = :rejection_reason";
}

$query = "UPDATE members
          SET manager_status = :manager_status,
              manager_reviewed_at = NOW(),
              manager_note = :manager_note,
              updated_at = NOW()" . $additionalClauses . "
          WHERE id = :id";

$stmt = $db->prepare($query);
$stmt->bindParam(':manager_status', $managerStatus);

if ($managerNote !== null && $managerNote !== '') {
    $sanitizedNote = htmlspecialchars($managerNote, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $stmt->bindParam(':manager_note', $sanitizedNote);
} else {
    $sanitizedNote = null;
    $stmt->bindValue(':manager_note', null, PDO::PARAM_NULL);
}

$stmt->bindParam(':id', $input->id);

if ($managerStatus === 'rejected') {
    $rejectionReason = $sanitizedNote ?? '';
    $stmt->bindParam(':rejection_reason', $rejectionReason);
}

if ($stmt->execute()) {
    // Send email notification via Resend
    try {
        require_once __DIR__ . '/resend_transport.php';
        $fetchStmt = $db->prepare("SELECT email, full_name AS name FROM members WHERE id = :id");
        $fetchStmt->bindParam(':id', $input->id);
        $fetchStmt->execute();
        $member = $fetchStmt->fetch(PDO::FETCH_ASSOC);

        if ($member && !empty($member['email'])) {
            $orgName = trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church'));
            $displayName = $member['name'];

            if ($managerStatus === 'rejected') {
                $subject = 'Your membership request was not approved';
                $reasonText = $sanitizedNote ? "Reason: {$sanitizedNote}\n\n" : '';
                $textBody = "Hello {$displayName},\n\nThank you for your interest in joining us. After careful review, your membership request was not approved at this time.\n\n{$reasonText}If you have questions, feel free to contact us.\n\nBest regards,\n{$orgName}";
                $reasonHtml = $sanitizedNote ? '<p style="margin:0 0 16px;background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b;"><strong>Reason:</strong> ' . htmlspecialchars($sanitizedNote) . '</p>' : '';
                $htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
                    <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 24px;text-align:center;">
                    <div style="font-size:13px;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Membership Update</div>
                    <div style="font-size:20px;font-weight:700;color:#fff;">' . htmlspecialchars($orgName) . '</div>
                    </td></tr>
                    <tr><td style="padding:32px 28px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
                    <p style="margin:0 0 16px;font-size:18px;color:#0f172a;"><strong>Hello ' . htmlspecialchars($displayName) . ',</strong></p>
                    <p style="margin:0 0 16px;">Thank you for your interest in joining ' . htmlspecialchars($orgName) . '. After careful review, your membership request was not approved at this time.</p>
                    ' . $reasonHtml . '
                    <p style="margin:0;">If you have any questions, feel free to reach out to us.</p>
                    </td></tr>
                    <tr><td style="padding:16px 28px 28px;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center;">' . htmlspecialchars($orgName) . '</td></tr>
                    </table></td></tr></table></body></html>';
                sendEmailViaResendApi($member['email'], $displayName, $subject, $htmlBody, $textBody);
            }
        }
    } catch (Throwable $e) {
        error_log('update_manager_status email error: ' . $e->getMessage());
    }

    echo json_encode([
        "message" => "Manager review status updated successfully.",
        "manager_status" => $managerStatus
    ]);
} else {
    http_response_code(503);
    echo json_encode(["message" => "Unable to update manager review status."]);
}
?>

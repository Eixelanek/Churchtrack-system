<?php
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

$validStatuses = ['pending', 'recommended', 'not_recommended', 'rejected'];
if (!in_array($input->manager_status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid manager_status value."]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Ensure rejection_reason column exists
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

$managerStatus   = $input->manager_status;
$recommendNote   = isset($input->manager_recommendation_note)
    ? trim($input->manager_recommendation_note)
    : (isset($input->manager_note) ? trim($input->manager_note) : null); // backward compat

// Note is required for not_recommended and rejected
if (in_array($managerStatus, ['not_recommended', 'rejected'], true) && ($recommendNote === null || $recommendNote === '')) {
    http_response_code(400);
    echo json_encode(["message" => "A reason is required when the status is '{$managerStatus}'."]);
    exit();
}

// Hard-reject also updates member status to 'rejected'
$additionalClauses = '';
if ($managerStatus === 'rejected') {
    $additionalClauses = ",
              status = 'rejected',
              rejection_reason = :rejection_reason";
}

$query = "UPDATE members
          SET manager_status = :manager_status,
              manager_reviewed_at = NOW(),
              manager_recommendation_note = :manager_recommendation_note,
              updated_at = NOW()" . $additionalClauses . "
          WHERE id = :id";

$stmt = $db->prepare($query);
$stmt->bindParam(':manager_status', $managerStatus);

$sanitizedNote = ($recommendNote !== null && $recommendNote !== '')
    ? htmlspecialchars($recommendNote, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
    : null;

if ($sanitizedNote !== null) {
    $stmt->bindParam(':manager_recommendation_note', $sanitizedNote);
} else {
    $stmt->bindValue(':manager_recommendation_note', null, PDO::PARAM_NULL);
}

$stmt->bindParam(':id', $input->id);

if ($managerStatus === 'rejected') {
    $rejectionReason = $sanitizedNote ?? '';
    $stmt->bindParam(':rejection_reason', $rejectionReason);
}

if ($stmt->execute()) {
    // Send email only for hard rejection
    if ($managerStatus === 'rejected') {
        try {
            require_once __DIR__ . '/resend_transport.php';
            $fetchStmt = $db->prepare("SELECT email, CONCAT(first_name, ' ', surname) AS name FROM members WHERE id = :id");
            $fetchStmt->bindParam(':id', $input->id);
            $fetchStmt->execute();
            $member = $fetchStmt->fetch(PDO::FETCH_ASSOC);

            if ($member && !empty($member['email'])) {
                $orgName     = trim((string)(getenv('CHURCH_NAME') ?: 'Christ-Like Christian Church'));
                $displayName = $member['name'];
                $subject     = 'Your membership request was not approved';
                $reasonHtml  = $sanitizedNote
                    ? '<p style="margin:0 0 16px;background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b;"><strong>Reason:</strong> ' . htmlspecialchars($sanitizedNote) . '</p>'
                    : '';
                $htmlBody = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
                    <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 24px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#fff;">' . htmlspecialchars($orgName) . '</div></td></tr>
                    <tr><td style="padding:32px 28px;font-family:Arial,sans-serif;font-size:16px;color:#334155;">
                    <p>Hello <strong>' . htmlspecialchars($displayName) . '</strong>,</p>
                    <p>Thank you for your interest. After careful review, your membership request was not approved at this time.</p>
                    ' . $reasonHtml . '
                    <p>If you have questions, feel free to contact us.</p>
                    </td></tr></table></td></tr></table></body></html>';
                $textBody = "Hello {$displayName},\n\nYour membership request was not approved.\n" . ($sanitizedNote ? "Reason: {$sanitizedNote}\n" : '') . "\nRegards,\n{$orgName}";
                sendEmailViaResendApi($member['email'], $displayName, $subject, $htmlBody, $textBody);
            }
        } catch (Throwable $e) {
            error_log('update_manager_status email error: ' . $e->getMessage());
        }
    }

    echo json_encode([
        "success"        => true,
        "message"        => "Manager review status updated successfully.",
        "manager_status" => $managerStatus
    ]);
} else {
    http_response_code(503);
    echo json_encode(["message" => "Unable to update manager review status."]);
}
?>

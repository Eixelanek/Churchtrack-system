<?php
// PHPMailer namespace imports
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id) && !empty($data->status)) {
    $database = new Database();
    $db = $database->getConnection();

    // Ensure rejection_reason column exists for backward compatibility
    try {
        $colCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'rejection_reason'");
        $colCheck->execute();
        if ($colCheck->rowCount() === 0) {
            $db->exec("ALTER TABLE members ADD COLUMN rejection_reason TEXT NULL AFTER status");
        }
    } catch (Exception $e) {
        // Fail silently; subsequent queries will surface any issues
    }

    // Ensure manager review columns exist
    try {
        $managerCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'manager_status'");
        $managerCheck->execute();
        if ($managerCheck->rowCount() === 0) {
            $db->exec("ALTER TABLE members ADD COLUMN manager_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER status, ADD COLUMN manager_reviewed_at DATETIME NULL AFTER manager_status, ADD COLUMN manager_note TEXT NULL AFTER manager_reviewed_at");
        }
    } catch (Exception $e) {
        // Fail silently; subsequent queries will surface any issues
    }

    // Validate status
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
                  manager_status = 'approved',
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

    if ($stmt->execute()) {
        // Fetch member's email and name
        $fetchQuery = "SELECT email, full_name AS name FROM members WHERE id = :id";
        $fetchStmt = $db->prepare($fetchQuery);
        $fetchStmt->bindParam(":id", $data->id);
        $fetchStmt->execute();
        $member = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        // If status is rejected, clean up old rejected members (older than 30 days)
        if ($data->status === 'rejected') {
            $cleanupQuery = "DELETE FROM members 
                            WHERE status = 'rejected' 
                            AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
                            AND id != :current_id";
            $cleanupStmt = $db->prepare($cleanupQuery);
            $cleanupStmt->bindParam(":current_id", $data->id);
            $cleanupStmt->execute();
        }
        
        if ($member && !empty($member['email'])) {
            // Send email notification
            require_once '../../vendor/phpmailer/phpmailer/src/PHPMailer.php';
            require_once '../../vendor/phpmailer/phpmailer/src/SMTP.php';
            require_once '../../vendor/phpmailer/phpmailer/src/Exception.php';
            $mail = new PHPMailer(true);
            try {
                // SMTP settings (adjust as needed for your environment)
                $mail->isSMTP();
                $mail->Host = 'sandbox.smtp.mailtrap.io';
                $mail->SMTPAuth = true;
                $mail->Username = '6d9592f68fe27b';
                $mail->Password = 'b66f2375c2b4db';
                $mail->Port = 2525;
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->CharSet = 'UTF-8';
                $orgName = 'FaithTrack'; // Change to your organization name if needed
                $mail->setFrom('noreply@yourdomain.com', 'Church Admin');
                $mail->addAddress($member['email'], $member['name']);
                if ($data->status === 'active') {
                    $mail->Subject = 'Your membership has been approved!';
                    $mail->Body = "Hello {$member['name']},\n\nCongratulations! Your membership request has been approved.\n\nYou now have full access to all member features. We're excited to have you on board and look forward to your participation.\n\nIf you have any questions or need assistance, don't hesitate to reach out.\n\nWelcome!\n$orgName";
                } elseif ($data->status === 'rejected') {
                    $mail->Subject = 'Your membership request was rejected';
                    $reasonText = $rejectionReason ? "Reason: {$rejectionReason}\n\n" : '';
                    $mail->Body = "Hello {$member['name']},\n\nThank you for your interest in joining us. After careful review, we regret to inform you that your membership request has been rejected.\n\n{$reasonText}If you have any questions or believe this may be a mistake, feel free to contact us.\n\nBest regards,\n$orgName";
                }
                $mail->send();
            } catch (Exception $e) {
                // Log or handle email error if needed
            }
        }
        echo json_encode([
            "message" => "Member status updated successfully",
            "status" => $data->status,
            "reason" => $rejectionReason
        ]);
    } else {
        http_response_code(503);
        echo json_encode(["message" => "Unable to update member status"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Unable to update status. Data is incomplete."]);
}
?> 
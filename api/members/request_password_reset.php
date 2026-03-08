<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set('Asia/Manila');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

include_once '../config/database.php';

function ensurePasswordResetInfrastructure(PDO $db): void
{
    $db->exec("CREATE TABLE IF NOT EXISTS password_reset_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
        requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        processed_by_admin_id INT NULL,
        admin_note TEXT NULL,
        temporary_password_hash VARCHAR(255) NULL,
        temporary_password_expires_at DATETIME NULL,
        INDEX idx_member_status (member_id, status),
        CONSTRAINT fk_reset_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Ensure members table has required columns for reset flow
    $columns = [
        'must_change_password' => "ALTER TABLE members ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password",
        'password_temp_expires_at' => "ALTER TABLE members ADD COLUMN password_temp_expires_at DATETIME NULL AFTER must_change_password"
    ];

    foreach ($columns as $column => $alterSql) {
        $checkStmt = $db->prepare("SHOW COLUMNS FROM members LIKE :column_name");
        $checkStmt->bindParam(':column_name', $column);
        if ($checkStmt->execute() && $checkStmt->rowCount() === 0) {
            $db->exec($alterSql);
        }
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $payload = json_decode(file_get_contents('php://input'), true);

    if (!isset($payload['username']) || trim($payload['username']) === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Username is required.'
        ]);
        exit();
    }

    ensurePasswordResetInfrastructure($db);

    $username = trim($payload['username']);

    $memberQuery = $db->prepare("SELECT id, first_name, middle_name, surname, suffix FROM members WHERE username = :username LIMIT 1");
    $memberQuery->bindParam(':username', $username);
    $memberQuery->execute();
    $member = $memberQuery->fetch(PDO::FETCH_ASSOC);

    $responseMessage = 'Your request has been sent to the administrator. Please wait for further instructions.';
    $duplicatePendingMessage = 'You already have a pending password reset request. The administrator has been notified.';

    if (!$member) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'We couldn\'t find an account with that username. Please check and try again.'
        ]);
        exit();
    }

    $memberId = (int)$member['id'];
    $memberFullName = trim(implode(' ', array_filter([
        $member['first_name'] ?? '',
        $member['middle_name'] ?? '',
        $member['surname'] ?? '',
        (isset($member['suffix']) && strtolower($member['suffix']) !== 'none') ? $member['suffix'] : ''
    ])));

    if ($memberFullName === '') {
        $memberFullName = $username;
    }

    // Avoid duplicate pending requests by checking the latest status
    $pendingCheck = $db->prepare("SELECT id FROM password_reset_requests WHERE member_id = :member_id AND status = 'pending' ORDER BY requested_at DESC LIMIT 1");
    $pendingCheck->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $pendingCheck->execute();

    if ($pendingCheck->rowCount() === 0) {
        $insert = $db->prepare("INSERT INTO password_reset_requests (member_id, status) VALUES (:member_id, 'pending')");
        $insert->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $insert->execute();

        // Create admin notification entry
        try {
            $notificationMessage = sprintf('%s requested a password reset.', $memberFullName);
            $notificationStmt = $db->prepare("INSERT INTO notifications (type, message, member_id) VALUES ('password_reset_request', :message, :member_id)");
            $notificationStmt->bindParam(':message', $notificationMessage);
            $notificationStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
            $notificationStmt->execute();
        } catch (Exception $notificationError) {
            error_log('Failed to create password reset notification: ' . $notificationError->getMessage());
        }
    } else {
        $responseMessage = $duplicatePendingMessage;
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => $responseMessage
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

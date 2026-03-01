<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600");
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

function generateTemporaryPassword(int $length = 10): string
{
    $characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
    $charactersLength = strlen($characters);
    $password = '';

    for ($i = 0; $i < $length; $i++) {
        $index = random_int(0, $charactersLength - 1);
        $password .= $characters[$index];
    }

    return $password;
}

try {
    $payload = json_decode(file_get_contents('php://input'), true);

    if (!isset($payload['admin_id'], $payload['request_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Admin ID and request ID are required.'
        ]);
        exit();
    }

    $adminId = (int) $payload['admin_id'];
    $requestId = (int) $payload['request_id'];
    $adminNote = isset($payload['admin_note']) ? trim((string) $payload['admin_note']) : null;
    $expiryHours = isset($payload['expires_in_hours']) ? max(1, (int) $payload['expires_in_hours']) : 24;

    if ($adminId <= 0 || $requestId <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid identifiers supplied.'
        ]);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();

    ensurePasswordResetInfrastructure($db);

    $requestStmt = $db->prepare("SELECT 
            pr.id,
            pr.member_id,
            pr.status,
            pr.requested_at,
            m.username,
            m.full_name,
            m.email,
            m.contact_number
        FROM password_reset_requests pr
        INNER JOIN members m ON m.id = pr.member_id
        WHERE pr.id = :request_id
        LIMIT 1");
    $requestStmt->bindParam(':request_id', $requestId, PDO::PARAM_INT);
    $requestStmt->execute();

    $request = $requestStmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Password reset request not found.'
        ]);
        exit();
    }

    if ($request['status'] !== 'pending') {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This password reset request has already been processed.'
        ]);
        exit();
    }

    $temporaryPassword = generateTemporaryPassword();
    $temporaryPasswordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);
    $expiresAt = (new DateTimeImmutable())->add(new DateInterval('PT' . $expiryHours . 'H'));
    $expiresAtFormatted = $expiresAt->format('Y-m-d H:i:s');

    $db->beginTransaction();

    $updateMember = $db->prepare("UPDATE members
        SET password = :password,
            must_change_password = 1,
            password_temp_expires_at = :expires_at,
            updated_at = NOW()
        WHERE id = :member_id");
    $updateMember->bindParam(':password', $temporaryPasswordHash);
    $updateMember->bindParam(':expires_at', $expiresAtFormatted);
    $updateMember->bindParam(':member_id', $request['member_id'], PDO::PARAM_INT);
    $updateMember->execute();

    $updateRequest = $db->prepare("UPDATE password_reset_requests
        SET status = 'completed',
            processed_at = NOW(),
            processed_by_admin_id = :admin_id,
            admin_note = :admin_note,
            temporary_password_hash = :temp_hash,
            temporary_password_expires_at = :temp_expiry
        WHERE id = :request_id");
    $updateRequest->bindParam(':admin_id', $adminId, PDO::PARAM_INT);
    $updateRequest->bindParam(':admin_note', $adminNote);
    $updateRequest->bindParam(':temp_hash', $temporaryPasswordHash);
    $updateRequest->bindParam(':temp_expiry', $expiresAtFormatted);
    $updateRequest->bindParam(':request_id', $requestId, PDO::PARAM_INT);
    $updateRequest->execute();

    // Cancel other pending requests for the same member
    $cancelOthers = $db->prepare("UPDATE password_reset_requests
        SET status = 'cancelled',
            processed_at = NOW(),
            processed_by_admin_id = :admin_id,
            admin_note = 'Automatically cancelled due to a newer reset request being completed.'
        WHERE member_id = :member_id
          AND status = 'pending'
          AND id <> :request_id");
    $cancelOthers->bindParam(':admin_id', $adminId, PDO::PARAM_INT);
    $cancelOthers->bindParam(':member_id', $request['member_id'], PDO::PARAM_INT);
    $cancelOthers->bindParam(':request_id', $requestId, PDO::PARAM_INT);
    $cancelOthers->execute();

    try {
        $notificationMessage = sprintf('A temporary password has been generated for %s (%s).', $request['full_name'] ?? $request['username'], $request['username']);
        $notificationStmt = $db->prepare("INSERT INTO notifications (type, message, member_id) VALUES ('password_reset_completed', :message, :member_id)");
        $notificationStmt->bindParam(':message', $notificationMessage);
        $notificationStmt->bindParam(':member_id', $request['member_id'], PDO::PARAM_INT);
        $notificationStmt->execute();
    } catch (Exception $notificationError) {
        error_log('Failed to create password reset completion notification: ' . $notificationError->getMessage());
    }

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Temporary password generated successfully.',
        'temporary_password' => $temporaryPassword,
        'expires_at' => $expiresAtFormatted
    ]);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

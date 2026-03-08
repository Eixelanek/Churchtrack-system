<?php
header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set('Asia/Manila');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

try {
    $database = new Database();
    $db = $database->getConnection();

    ensurePasswordResetInfrastructure($db);

    // Automatically delete completed requests older than the retention window
    $retentionDays = 30;
    $cleanupStmt = $db->prepare("DELETE FROM password_reset_requests WHERE status = 'completed' AND processed_at IS NOT NULL AND processed_at < DATE_SUB(NOW(), INTERVAL :retention DAY)");
    $cleanupStmt->bindParam(':retention', $retentionDays, PDO::PARAM_INT);
    $cleanupStmt->execute();

    $statusFilter = isset($_GET['status']) ? strtolower(trim($_GET['status'])) : 'pending';
    $allowedStatuses = ['pending', 'completed', 'cancelled', 'all'];
    if (!in_array($statusFilter, $allowedStatuses, true)) {
        $statusFilter = 'pending';
    }

    $query = "SELECT 
                pr.id,
                pr.member_id,
                m.full_name AS member_name,
                m.username,
                m.contact_number,
                m.email,
                pr.status,
                pr.requested_at,
                pr.processed_at,
                pr.processed_by_admin_id,
                pr.admin_note,
                pr.temporary_password_expires_at,
                n.id AS notification_id,
                n.created_at AS notification_created_at
              FROM password_reset_requests pr
              INNER JOIN members m ON m.id = pr.member_id
              LEFT JOIN notifications n
                ON n.member_id = pr.member_id
               AND n.type = 'password_reset_request'
               AND DATE(n.created_at) = DATE(pr.requested_at)";

    if ($statusFilter !== 'all') {
        $query .= " WHERE pr.status = :status";
    }

    $query .= " ORDER BY CASE pr.status WHEN 'pending' THEN 0 WHEN 'cancelled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, pr.requested_at DESC";

    $stmt = $db->prepare($query);
    if ($statusFilter !== 'all') {
        $stmt->bindParam(':status', $statusFilter);
    }
    $stmt->execute();

    $requests = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $requests[] = [
            'id' => (int) $row['id'],
            'member_id' => (int) $row['member_id'],
            'member_name' => $row['member_name'],
            'username' => $row['username'],
            'contact_number' => $row['contact_number'],
            'email' => $row['email'],
            'status' => $row['status'],
            'requested_at' => $row['requested_at'],
            'processed_at' => $row['processed_at'],
            'processed_by_admin_id' => $row['processed_by_admin_id'] ? (int) $row['processed_by_admin_id'] : null,
            'admin_note' => $row['admin_note'],
            'temporary_password_expires_at' => $row['temporary_password_expires_at'],
            'notification_id' => $row['notification_id'] ? (int) $row['notification_id'] : null,
            'notification_created_at' => $row['notification_created_at']
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $requests
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

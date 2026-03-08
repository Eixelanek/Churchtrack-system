<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Ensure rejection_reason column exists (for backward compatibility)
    $colCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'rejection_reason'");
    $colCheck->execute();
    if ($colCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN rejection_reason TEXT NULL AFTER status");
    }

    // Ensure manager review columns exist for backward compatibility
    try {
        $managerCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'manager_status'");
        $managerCheck->execute();
        if ($managerCheck->rowCount() === 0) {
            $db->exec("ALTER TABLE members ADD COLUMN manager_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER status, ADD COLUMN manager_reviewed_at DATETIME NULL AFTER manager_status, ADD COLUMN manager_note TEXT NULL AFTER manager_reviewed_at");
        }
    } catch (Exception $e) {
        // Fail silently to allow legacy response
    }

    // Get all rejected membership requests with manager context
    $query = "SELECT 
                id,
                surname,
                first_name,
                middle_name,
                suffix,
                CONCAT(first_name, ' ', 
                       COALESCE(CONCAT(middle_name, ' '), ''), 
                       surname,
                       CASE WHEN suffix != 'None' THEN CONCAT(' ', suffix) ELSE '' END) as name,
                username,
                email,
                birthday,
                status,
                rejection_reason,
                manager_status,
                manager_reviewed_at,
                manager_note,
                created_at,
                updated_at
              FROM members
              WHERE status = 'rejected'
              ORDER BY created_at DESC";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $rejectedRequests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    // Normalize manager fields
    $normalized = array_map(function ($item) {
        $item['manager_status'] = $item['manager_status'] ?? 'pending';
        $item['manager_note'] = $item['manager_note'] ?? null;
        $item['manager_reviewed_at'] = $item['manager_reviewed_at'] ?? null;
        return $item;
    }, $rejectedRequests);

    echo json_encode($normalized);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching rejected requests: " . $e->getMessage()
    ]);
}
?>

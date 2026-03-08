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

function tableExists(PDO $db, string $tableName): bool {
    $tableName = str_replace('`', '', $tableName);
    $stmt = $db->query("SHOW TABLES LIKE '" . $tableName . "'");
    return $stmt !== false && $stmt->rowCount() > 0;
}

try {
    $maintenanceTasks = [
        [
            'name' => 'Expired verification codes',
            'table' => 'verification_codes',
            'query' => "DELETE FROM verification_codes WHERE is_used = 1 OR created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        ],
        [
            'name' => 'Inactive admin sessions (30+ days)',
            'table' => 'admin_sessions',
            'query' => "DELETE FROM admin_sessions WHERE is_active = 0 AND COALESCE(last_activity, created_at) < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        ],
        [
            'name' => 'Old login history records (90+ days)',
            'table' => 'login_history',
            'query' => "DELETE FROM login_history WHERE login_time < DATE_SUB(NOW(), INTERVAL 90 DAY)"
        ],
        [
            'name' => 'Rejected member applications (60+ days)',
            'table' => 'members',
            'query' => "DELETE FROM members WHERE status = 'rejected' AND updated_at IS NOT NULL AND updated_at < DATE_SUB(NOW(), INTERVAL 60 DAY)"
        ],
        [
            'name' => 'Stale pending member requests (90+ days)',
            'table' => 'members',
            'query' => "DELETE FROM members WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
        ],
        [
            'name' => 'Guardian data for members aged 18 and above',
            'table' => 'members',
            'query' => "UPDATE members SET guardian_surname = NULL, guardian_first_name = NULL, guardian_middle_name = NULL, guardian_suffix = 'None', relationship_to_guardian = NULL WHERE birthday IS NOT NULL AND TIMESTAMPDIFF(YEAR, birthday, CURDATE()) >= 18 AND (guardian_surname IS NOT NULL OR guardian_first_name IS NOT NULL OR guardian_middle_name IS NOT NULL OR (guardian_suffix IS NOT NULL AND guardian_suffix != 'None') OR relationship_to_guardian IS NOT NULL)"
        ],
    ];

    $summary = [];
    $totalDeleted = 0;

    foreach ($maintenanceTasks as $task) {
        $tableName = $task['table'];
        if (!tableExists($db, $tableName)) {
            $summary[] = [
                'name' => $task['name'],
                'deleted' => 0,
                'skipped' => true,
                'message' => "Table '{$tableName}' not found."
            ];
            continue;
        }

        $stmt = $db->prepare($task['query']);
        $stmt->execute();
        $removed = $stmt->rowCount();
        $totalDeleted += $removed;

        $summary[] = [
            'name' => $task['name'],
            'deleted' => (int)$removed,
            'skipped' => false,
            'message' => $removed > 0
                ? "Removed {$removed} record(s)."
                : 'No outdated records found.'
        ];
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'System maintenance completed successfully.',
        'data' => [
            'tasks' => $summary,
            'totalDeleted' => $totalDeleted,
            'ranAt' => date('Y-m-d H:i:s')
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

?>


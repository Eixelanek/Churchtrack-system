<?php

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Ensure manager review columns exist
try {
    $colCheck = $db->prepare("SHOW COLUMNS FROM members LIKE 'manager_status'");
    $colCheck->execute();
    if ($colCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN manager_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER status, ADD COLUMN manager_reviewed_at DATETIME NULL AFTER manager_status, ADD COLUMN manager_note TEXT NULL AFTER manager_reviewed_at");
    }
} catch (Exception $e) {
    // Fail silently; endpoints will surface issues if alteration fails
}


$scope = isset($_GET['scope']) ? strtolower(trim($_GET['scope'])) : 'admin';
if (!in_array($scope, ['admin', 'manager'], true)) {
    $scope = 'admin';
}

$query = "SELECT 
            m.id, 
            CONCAT(m.first_name, ' ', 
                   COALESCE(CONCAT(m.middle_name, ' '), ''), 
                   m.surname,
                   CASE WHEN m.suffix != 'None' THEN CONCAT(' ', m.suffix) ELSE '' END) as name,
            m.username, 
            m.email, 
            m.birthday, 
            m.status, 
            m.manager_status,
            m.manager_reviewed_at,
            m.manager_note,
            m.created_at, 
            m.updated_at,
            m.guardian_surname,
            m.guardian_first_name,
            m.guardian_middle_name,
            m.guardian_suffix,
            m.relationship_to_guardian,
            m.referrer_id,
            m.referrer_name,
            m.relationship_to_referrer
          FROM members m
          WHERE m.status = 'pending'";

if ($scope === 'admin') {
    $query .= " AND m.manager_status = 'approved'";
} else {
    $query .= " AND m.manager_status != 'approved'";
}

$stmt = $db->prepare($query);
$stmt->execute();

$pending_members = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($pending_members as &$member) {
    $member['guardian_suffix'] = ($member['guardian_suffix'] ?? null) !== 'None' ? $member['guardian_suffix'] : null;
    $guardianParts = array_filter([
        $member['guardian_first_name'] ?? null,
        $member['guardian_middle_name'] ?? null,
        $member['guardian_surname'] ?? null,
        $member['guardian_suffix'] ?? null
    ]);
    $member['guardian_full_name'] = !empty($guardianParts) ? implode(' ', $guardianParts) : null;
    $member['has_guardian'] = !empty($member['guardian_full_name']);

    if (!empty($member['birthday'])) {
        try {
            $birthDate = new DateTime($member['birthday']);
            $today = new DateTime();
            $member['age'] = $today->diff($birthDate)->y;
            $member['is_minor'] = $member['age'] <= 17;
        } catch (Exception $e) {
            $member['age'] = null;
            $member['is_minor'] = false;
        }
    } else {
        $member['age'] = null;
        $member['is_minor'] = false;
    }

    $member['referrer_id'] = $member['referrer_id'] ? (int)$member['referrer_id'] : null;
    $member['referrer_name'] = $member['referrer_name'] ?: null;
    $member['relationship_to_referrer'] = $member['relationship_to_referrer'] ?: null;
    // Member is considered referred if they have either a referrer_id or a referrer_name
    $member['is_referred'] = !empty($member['referrer_id']) || !empty($member['referrer_name']);
    $member['manager_status'] = $member['manager_status'] ?? 'pending';
}

echo json_encode($pending_members);
?> 
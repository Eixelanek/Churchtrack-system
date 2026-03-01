<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $statsQuery = "SELECT 
                        ga.guest_id,
                        COUNT(*) AS total_visits,
                        MAX(ga.checkin_time) AS last_attended,
                        SUM(CASE WHEN LOWER(TRIM(qs.service_name)) = 'sunday service' AND ga.status IN ('present','late') THEN 1 ELSE 0 END) AS sunday_visits
                   FROM guest_attendance ga
                   LEFT JOIN qr_sessions qs ON qs.id = ga.session_id
                   GROUP BY ga.guest_id";

    $statsStmt = $db->prepare($statsQuery);
    $statsStmt->execute();
    $statsRows = $statsStmt->fetchAll(PDO::FETCH_ASSOC);

    $attendanceStats = [];
    foreach ($statsRows as $row) {
        $guestId = (int)($row['guest_id'] ?? 0);
        if ($guestId <= 0) {
            continue;
        }
        $attendanceStats[$guestId] = [
            'total_visits' => (int)($row['total_visits'] ?? 0),
            'last_attended' => $row['last_attended'] ?? null,
            'sunday_visits' => (int)($row['sunday_visits'] ?? 0)
        ];
    }

    $query = "SELECT 
                  g.id,
                  g.first_name,
                  g.middle_name,
                  g.surname,
                  g.suffix,
                  g.full_name,
                  g.contact_number,
                  g.email,
                  g.status,
                  g.first_visit_date,
                  g.last_visit_date,
                  g.invited_by_member_id,
                  g.invited_by_text,
                  g.notes,
                  g.created_at,
                  g.updated_at,
                  inviter.id AS inviter_id,
                  CONCAT(inviter.first_name, ' ', 
                         COALESCE(CONCAT(inviter.middle_name, ' '), ''), 
                         inviter.surname,
                         CASE WHEN inviter.suffix IS NOT NULL AND inviter.suffix <> '' AND inviter.suffix <> 'None' THEN CONCAT(' ', inviter.suffix) ELSE '' END
                  ) AS inviter_name
              FROM guests g
              LEFT JOIN members inviter ON inviter.id = g.invited_by_member_id
              ORDER BY COALESCE(g.last_visit_date, g.created_at) DESC, g.full_name ASC";

    $stmt = $db->prepare($query);
    $stmt->execute();
    $guests = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $guestId = (int)$row['id'];
        $stats = $attendanceStats[$guestId] ?? [
            'total_visits' => 0,
            'last_attended' => null,
            'sunday_visits' => 0
        ];

        $fullNameParts = array_filter([
            $row['first_name'] ?? '',
            $row['middle_name'] ?? '',
            $row['surname'] ?? '',
            (isset($row['suffix']) && !empty($row['suffix']) && strtolower($row['suffix']) !== 'none') ? $row['suffix'] : ''
        ]);
        $fullName = trim(implode(' ', $fullNameParts));
        if ($fullName === '') {
            $fullName = $row['full_name'] ?? '';
        }

        $remainingForMembership = max(0, 4 - min(4, (int)$stats['sunday_visits']));

        $guests[] = [
            'id' => $guestId,
            'full_name' => $fullName,
            'first_name' => $row['first_name'] ?? '',
            'middle_name' => $row['middle_name'] ?? '',
            'surname' => $row['surname'] ?? '',
            'suffix' => $row['suffix'] ?? '',
            'contact_number' => $row['contact_number'] ?? null,
            'email' => $row['email'] ?? null,
            'status' => $row['status'] ?? 'active',
            'first_visit_date' => $row['first_visit_date'] ?? null,
            'last_visit_date' => $row['last_visit_date'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'invited_by_member_id' => $row['invited_by_member_id'] ? (int)$row['invited_by_member_id'] : null,
            'invited_by_name' => $row['inviter_name'] ?? null,
            'invited_by_text' => $row['invited_by_text'] ?? null,
            'notes' => $row['notes'] ?? null,
            'total_visits' => $stats['total_visits'],
            'last_attended' => $stats['last_attended'],
            'sunday_visit_count' => $stats['sunday_visits'],
            'remaining_for_membership' => $remainingForMembership
        ];
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => $guests
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load guests: ' . $e->getMessage()
    ]);
}

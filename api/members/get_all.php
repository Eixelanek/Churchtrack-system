<?php

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Get all active members with basic info including referral information
    $query = "SELECT 
                m.id, 
                CONCAT(m.first_name, ' ', 
                       COALESCE(CONCAT(m.middle_name, ' '), ''), 
                       m.surname,
                       CASE WHEN m.suffix != 'None' THEN CONCAT(' ', m.suffix) ELSE '' END) as name,
                m.username, 
                m.email, 
                m.birthday, 
                m.gender,
                m.status, 
                m.created_at, 
                m.updated_at,
                m.contact_number,
                m.street,
                m.barangay,
                m.city,
                m.province,
                m.zip_code,
                m.guardian_surname,
                m.guardian_first_name,
                m.guardian_middle_name,
                m.guardian_suffix,
                m.relationship_to_guardian,
                m.referrer_id,
                m.referrer_name,
                m.relationship_to_referrer,
                m.profile_picture
              FROM members m
              WHERE m.status IN ('active', 'inactive')";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $attendanceStats = [];
    if (!empty($members)) {
        $memberIds = array_column($members, 'id');
        $placeholders = implode(',', array_fill(0, count($memberIds), '?'));

        $attendanceQuery = "SELECT 
                                a.member_id,
                                SUM(CASE WHEN LOWER(a.status) IN ('present','late') THEN 1 ELSE 0 END) AS total_visits,
                                MAX(CASE 
                                        WHEN LOWER(a.status) IN ('present','late') THEN COALESCE(e.date, DATE(a.check_in_time))
                                        ELSE NULL
                                    END) AS last_attended
                             FROM attendance a
                             LEFT JOIN events e ON e.id = a.event_id
                             WHERE a.member_id IN ($placeholders)
                             GROUP BY a.member_id";

        $attendanceStmt = $db->prepare($attendanceQuery);
        $attendanceStmt->execute($memberIds);

        while ($row = $attendanceStmt->fetch(PDO::FETCH_ASSOC)) {
            $attendanceStats[(int)$row['member_id']] = [
                'total_visits' => (int)($row['total_visits'] ?? 0),
                'last_attended' => $row['last_attended'] ?? null,
            ];
        }

        // Include legacy attendance_records data for historical visits (if table exists)
        $recordsQuery = "SELECT 
                              member_id,
                              COUNT(*) AS total_visits,
                              MAX(attendance_date) AS last_attended
                           FROM attendance_records
                           WHERE member_id IN ($placeholders)
                           GROUP BY member_id";

        try {
            $recordsStmt = $db->prepare($recordsQuery);
            $recordsStmt->execute($memberIds);

            while ($row = $recordsStmt->fetch(PDO::FETCH_ASSOC)) {
                $memberId = (int)$row['member_id'];
                $existing = $attendanceStats[$memberId] ?? ['total_visits' => 0, 'last_attended' => null];

                $legacyTotal = (int)($row['total_visits'] ?? 0);
                $existing['total_visits'] = max($existing['total_visits'], $legacyTotal);

                $legacyLast = $row['last_attended'] ?? null;
                if (!empty($legacyLast)) {
                    $existingLast = $existing['last_attended'];
                    if (empty($existingLast) || strtotime($legacyLast) > strtotime($existingLast)) {
                        $existing['last_attended'] = $legacyLast;
                    }
                }

                $attendanceStats[$memberId] = $existing;
            }
        } catch (Exception $legacyAttendanceEx) {
            // Legacy attendance table may not exist on all deployments; ignore if missing
        }

        // Include QR attendance data (qr_attendance linked through qr_sessions -> events)
        $qrQuery = "SELECT 
                        qa.member_id,
                        COUNT(*) AS total_visits,
                        MAX(COALESCE(e.date, DATE(qa.checkin_datetime))) AS last_attended
                    FROM qr_attendance qa
                    INNER JOIN qr_sessions qs ON qs.id = qa.session_id
                    LEFT JOIN events e ON e.id = qs.event_id
                    WHERE qa.member_id IN ($placeholders)
                    GROUP BY qa.member_id";

        try {
            $qrStmt = $db->prepare($qrQuery);
            $qrStmt->execute($memberIds);

            while ($row = $qrStmt->fetch(PDO::FETCH_ASSOC)) {
                $memberId = (int)$row['member_id'];
                $existing = $attendanceStats[$memberId] ?? ['total_visits' => 0, 'last_attended' => null];

                $qrTotal = (int)($row['total_visits'] ?? 0);
                $existing['total_visits'] = max($existing['total_visits'], $qrTotal);

                $qrLast = $row['last_attended'] ?? null;
                if (!empty($qrLast)) {
                    $existingLast = $existing['last_attended'];
                    if (empty($existingLast) || strtotime($qrLast) > strtotime($existingLast)) {
                        $existing['last_attended'] = $qrLast;
                    }
                }

                $attendanceStats[$memberId] = $existing;
            }
        } catch (Exception $qrAttendanceEx) {
            // Ignore if QR attendance tables are missing
        }
    }

    // For each member, add default values for attendance (since table doesn't exist yet)
    foreach ($members as &$member) {
        $memberId = (int)$member['id'];

        // Set default attendance values
        $member['total_visits'] = 0;
        $member['last_attended'] = null;
        $member['attendance_rate'] = 0;

        if (isset($attendanceStats[$memberId])) {
            $stats = $attendanceStats[$memberId];
            $member['total_visits'] = (int)($stats['total_visits'] ?? 0);

            if (!empty($stats['last_attended'])) {
                try {
                    $member['last_attended'] = (new DateTime($stats['last_attended']))->format('Y-m-d');
                } catch (Exception $e) {
                    $member['last_attended'] = $stats['last_attended'];
                }
            }
        }

        // Format address
        $addressParts = array_filter([
            $member['street'],
            $member['barangay'],
            $member['city'],
            $member['province']
        ]);
        $member['address'] = !empty($addressParts) ? implode(', ', $addressParts) : 'Not provided';
        
        // Normalize guardian data
        $member['guardian_suffix'] = ($member['guardian_suffix'] ?? null) !== 'None' ? $member['guardian_suffix'] : null;
        $guardianParts = array_filter([
            $member['guardian_first_name'] ?? null,
            $member['guardian_middle_name'] ?? null,
            $member['guardian_surname'] ?? null,
            $member['guardian_suffix'] ?? null
        ]);
        $member['guardian_full_name'] = !empty($guardianParts) ? implode(' ', $guardianParts) : null;
        $member['has_guardian'] = !empty($member['guardian_full_name']);

        // Calculate age helper
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

        // Get family member count (check if table exists first)
        $member['family_count'] = 0;
        try {
            $tableCheck = $db->query("SHOW TABLES LIKE 'family_members'");
            if ($tableCheck && $tableCheck->rowCount() > 0) {
                $familyQuery = "SELECT COUNT(*) as family_count FROM family_members WHERE primary_member_id = :member_id";
                $familyStmt = $db->prepare($familyQuery);
                $familyStmt->bindParam(':member_id', $memberId);
                $familyStmt->execute();
                $familyResult = $familyStmt->fetch(PDO::FETCH_ASSOC);
                $member['family_count'] = (int)$familyResult['family_count'];
            }
        } catch (Exception $e) {
            // Table doesn't exist or error, set to 0
            $member['family_count'] = 0;
        }
        
        // Get referral count (how many members this member referred)
        $referralQuery = "SELECT COUNT(*) as referral_count FROM members WHERE referrer_id = :member_id AND status IN ('active', 'pending')";
        $referralStmt = $db->prepare($referralQuery);
        $referralStmt->bindParam(':member_id', $memberId);
        $referralStmt->execute();
        $referralResult = $referralStmt->fetch(PDO::FETCH_ASSOC);
        $member['referral_count'] = (int)$referralResult['referral_count'];
        
        // Clean up referral fields
        $member['referrer_id'] = $member['referrer_id'] ? (int)$member['referrer_id'] : null;
        $member['referrer_name'] = $member['referrer_name'] ?: null;
        $member['relationship_to_referrer'] = $member['relationship_to_referrer'] ?: null;
        // Member is considered referred if they have either a referrer_id or a referrer_name
        $member['is_referred'] = !empty($member['referrer_id']) || !empty($member['referrer_name']);
    }
    
    echo json_encode($members);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching members: " . $e->getMessage()
    ]);
}
?>
<?php
/**
 * Delete active guests who missed 4 consecutive preset Sunday Service dates
 * after their last attendance. Run weekly via cron, e.g. Monday 02:00:
 *   php /path/to/api/guest/purge_inactive.php
 * Or HTTP with shared secret:
 *   GET .../purge_inactive.php?key=YOUR_CRON_SECRET
 */

header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/../config/database.php';

if (php_sapi_name() !== 'cli') {
    $secret = getenv('CRON_SECRET') ?: '';
    $key = isset($_GET['key']) ? trim((string)$_GET['key']) : '';
    if ($secret === '' || $key !== $secret) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit();
    }
}

/**
 * Most recent calendar Sunday on or before $d (in server/DB timezone context).
 */
function purge_sunday_on_or_before(DateTimeImmutable $d): DateTimeImmutable
{
    $n = (int)$d->format('N');
    if ($n === 7) {
        return $d;
    }
    return $d->modify(sprintf('-%d days', $n));
}

/**
 * Latest calendar date (Y-m-d) of any guest check-in for this guest.
 */
function purge_last_activity_date(PDO $db, int $guestId): ?string
{
    $stmt = $db->prepare(
        'SELECT MAX(DATE(COALESCE(qs.event_datetime, ga.checkin_time))) AS d
         FROM guest_attendance ga
         LEFT JOIN qr_sessions qs ON qs.id = ga.session_id
         WHERE ga.guest_id = :gid'
    );
    $stmt->bindValue(':gid', $guestId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return !empty($row['d']) ? (string)$row['d'] : null;
}

function purge_has_preset_sunday_on_date(PDO $db, int $guestId, string $dateYmd): bool
{
    $stmt = $db->prepare(
        'SELECT 1
         FROM guest_attendance ga
         INNER JOIN qr_sessions qs ON qs.id = ga.session_id
         WHERE ga.guest_id = :gid
           AND DATE(qs.event_datetime) = :dt
           AND LOWER(TRIM(qs.service_name)) = \'sunday service\'
           AND LOWER(TRIM(qs.event_type)) = \'preset\'
         LIMIT 1'
    );
    $stmt->bindValue(':gid', $guestId, PDO::PARAM_INT);
    $stmt->bindValue(':dt', $dateYmd);
    $stmt->execute();

    return (bool)$stmt->fetchColumn();
}

function purge_should_delete_guest(PDO $db, array $guest): bool
{
    $guestId = (int)($guest['id'] ?? 0);
    if ($guestId <= 0) {
        return false;
    }

    $lastActivity = purge_last_activity_date($db, $guestId);
    if ($lastActivity === null) {
        return false;
    }

    try {
        $anchor = new DateTimeImmutable($lastActivity);
    } catch (Exception $e) {
        return false;
    }

    try {
        $today = new DateTimeImmutable('today');
    } catch (Exception $e) {
        $today = new DateTimeImmutable(date('Y-m-d'));
    }

    $sunday = purge_sunday_on_or_before($today);
    $missed = 0;

    for ($i = 0; $i < 520; $i++) {
        if ($sunday <= $anchor) {
            break;
        }

        $dStr = $sunday->format('Y-m-d');
        if (!purge_has_preset_sunday_on_date($db, $guestId, $dStr)) {
            $missed++;
            if ($missed >= 4) {
                return true;
            }
        } else {
            break;
        }

        try {
            $sunday = $sunday->modify('-7 days');
        } catch (Exception $e) {
            break;
        }
    }

    return false;
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $listStmt = $db->query("SELECT id FROM guests WHERE status = 'active'");
    $ids = $listStmt->fetchAll(PDO::FETCH_COLUMN);
    $deletedIds = [];

    foreach ($ids as $gid) {
        $guestId = (int)$gid;
        if ($guestId <= 0) {
            continue;
        }

        $guestRowStmt = $db->prepare('SELECT id FROM guests WHERE id = :id AND status = :st LIMIT 1');
        $guestRowStmt->bindValue(':id', $guestId, PDO::PARAM_INT);
        $guestRowStmt->bindValue(':st', 'active');
        $guestRowStmt->execute();
        $row = $guestRowStmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            continue;
        }

        if (!purge_should_delete_guest($db, ['id' => $guestId])) {
            continue;
        }

        $db->beginTransaction();
        try {
            $delAtt = $db->prepare('DELETE FROM guest_attendance WHERE guest_id = :gid');
            $delAtt->bindValue(':gid', $guestId, PDO::PARAM_INT);
            $delAtt->execute();

            $delGuest = $db->prepare('DELETE FROM guests WHERE id = :gid AND status = \'active\'');
            $delGuest->bindValue(':gid', $guestId, PDO::PARAM_INT);
            $delGuest->execute();

            if ($delGuest->rowCount() > 0) {
                $deletedIds[] = $guestId;
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
        }
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'deleted_count' => count($deletedIds),
        'deleted_guest_ids' => $deletedIds
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

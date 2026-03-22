<?php

/**
 * Optional accepted family links for a new member (minors during registration).
 * Semantics match invite.php: member_id = new account, relative_id = existing member,
 * relationship_type = role of the existing member toward the new member.
 */
function link_family_after_registration(PDO $db, int $newMemberId, $familyLinks, int $age): void
{
    if ($age > 17 || $familyLinks === null) {
        return;
    }

    $items = [];
    if (is_array($familyLinks)) {
        $items = $familyLinks;
    } elseif (is_object($familyLinks)) {
        $items = (array) $familyLinks;
    } else {
        return;
    }

    $validTypes = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];
    $seen = [];
    $max = 5;
    $n = 0;

    $nameStmt = $db->prepare(
        'SELECT COALESCE(NULLIF(TRIM(full_name), \'\'), CONCAT(first_name, \' \', surname)) AS name FROM members WHERE id = ? LIMIT 1'
    );
    $newName = 'A new member';
    $nameStmt->execute([$newMemberId]);
    $nameRow = $nameStmt->fetch(PDO::FETCH_ASSOC);
    if ($nameRow && ! empty($nameRow['name'])) {
        $newName = $nameRow['name'];
    }

    foreach ($items as $item) {
        if ($n >= $max) {
            break;
        }

        $relativeId = 0;
        $relationship = '';

        if (is_array($item)) {
            $relativeId = isset($item['relativeId']) ? (int) $item['relativeId'] : (isset($item['relative_id']) ? (int) $item['relative_id'] : 0);
            $relationship = isset($item['relationship']) ? (string) $item['relationship'] : '';
        } elseif (is_object($item)) {
            $relativeId = isset($item->relativeId) ? (int) $item->relativeId : (isset($item->relative_id) ? (int) $item->relative_id : 0);
            $relationship = isset($item->relationship) ? (string) $item->relationship : '';
        }

        if ($relativeId <= 0 || $relativeId === $newMemberId) {
            continue;
        }
        if (! in_array($relationship, $validTypes, true)) {
            continue;
        }
        if (isset($seen[$relativeId])) {
            continue;
        }
        $seen[$relativeId] = true;

        $check = $db->prepare("SELECT id FROM members WHERE id = ? AND LOWER(status) = 'active'");
        $check->execute([$relativeId]);
        if ($check->rowCount() === 0) {
            continue;
        }

        try {
            $ins = $db->prepare(
                'INSERT INTO family_relationships
                (member_id, relative_id, relationship_type, status, notes, responded_at, initiated_at)
                VALUES (:nid, :rid, :rtype, \'accepted\', \'Linked during registration\', NOW(), NOW())'
            );
            $ins->bindValue(':nid', $newMemberId, PDO::PARAM_INT);
            $ins->bindValue(':rid', $relativeId, PDO::PARAM_INT);
            $ins->bindValue(':rtype', $relationship);
            $ins->execute();
            $n++;

            $msg = sprintf(
                '%s added you to their family circle as %s (registration).',
                $newName,
                $relationship
            );

            try {
                $notif = $db->prepare(
                    'INSERT INTO member_notifications (member_id, type, message, related_member_id)
                     VALUES (:mid, \'family_registration\', :msg, :related)'
                );
                $notif->bindValue(':mid', $relativeId, PDO::PARAM_INT);
                $notif->bindValue(':msg', $msg);
                $notif->bindValue(':related', $newMemberId, PDO::PARAM_INT);
                $notif->execute();
            } catch (Exception $e) {
                error_log('Family registration notification: ' . $e->getMessage());
            }
        } catch (PDOException $e) {
            $sqlState = $e->errorInfo[0] ?? '';
            $mysqlErr = (int) ($e->errorInfo[1] ?? 0);
            if ($sqlState === '23000' || $mysqlErr === 1062 || stripos($e->getMessage(), 'Duplicate') !== false) {
                continue;
            }
            error_log('Family link at registration: ' . $e->getMessage());
        }
    }
}

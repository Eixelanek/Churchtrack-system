<?php

// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
declare(strict_types=1);

if (!function_exists('labelIndicatesSunday')) {
    function labelIndicatesSunday(?string $value): bool
    {
        if ($value === null) {
            return false;
        }

        $normalized = strtolower(trim($value));

        if ($normalized === '') {
            return false;
        }

        if ($normalized === 'sunday service') {
            return true;
        }

        if (strpos($normalized, 'sunday service') !== false) {
            return true;
        }

        return strpos($normalized, 'sunday') !== false;
    }
}

if (!function_exists('evaluateInactiveMembers')) {
    /**
     * Evaluates active members and marks them inactive if they miss four consecutive Sunday Service events.
     *
     * @param PDO $db
     * @param callable|null $onMemberMarked Callback executed per member marked inactive. Receives array detail.
     *
     * @return array{
     *     checked_members:int,
     *     marked_inactive:int,
     *     details:array<int,array<string,mixed>>,
     *     sunday_service_count:int,
     *     has_sunday_services:bool
     * }
     */
    function evaluateInactiveMembers(PDO $db, ?callable $onMemberMarked = null): array
    {
        $summary = [
            'checked_members' => 0,
            'marked_inactive' => 0,
            'details' => [],
            'sunday_service_count' => 0,
            'has_sunday_services' => false,
        ];

        // Collect Sunday service occurrences from events and QR sessions.
        $serviceOccurrences = [];
        $eventIdToDate = [];
        $sessionIdToDate = [];
        $today = new DateTimeImmutable('today');

        // Legacy/managed events table (most recent 120 entries)
        $eventQuery = "SELECT id, title, event_type, date, status FROM events WHERE status IN ('active','completed') ORDER BY date DESC, id DESC LIMIT 120";
        $eventsStmt = $db->prepare($eventQuery);
        $eventsStmt->execute();

        while ($row = $eventsStmt->fetch(PDO::FETCH_ASSOC)) {
            if (empty($row['date'])) {
                continue;
            }

            try {
                $eventDate = new DateTimeImmutable($row['date']);
            } catch (Exception $e) {
                continue;
            }

            if (
                !labelIndicatesSunday($row['title'] ?? '') &&
                !labelIndicatesSunday($row['event_type'] ?? '') &&
                $eventDate->format('N') !== '7'
            ) {
                continue;
            }

            $status = strtolower((string) ($row['status'] ?? ''));

            if ($status !== 'completed' && $eventDate > $today) {
                continue;
            }

            $dateKey = $eventDate->format('Y-m-d');
            if (!isset($serviceOccurrences[$dateKey])) {
                $serviceOccurrences[$dateKey] = [
                    'date_obj' => $eventDate,
                    'event_ids' => [],
                    'session_ids' => [],
                ];
            }

            $eventId = (int) ($row['id'] ?? 0);
            if ($eventId > 0) {
                $serviceOccurrences[$dateKey]['event_ids'][] = $eventId;
                $eventIdToDate[$eventId] = $dateKey;
            }
        }

        // QR sessions (unified QR check-ins, most recent 240 entries)
        $sessionQuery = "SELECT id, event_id, service_name, event_datetime, status FROM qr_sessions WHERE event_datetime IS NOT NULL ORDER BY event_datetime DESC, id DESC LIMIT 240";
        $sessionStmt = $db->prepare($sessionQuery);
        $sessionStmt->execute();

        while ($row = $sessionStmt->fetch(PDO::FETCH_ASSOC)) {
            $eventDateTime = $row['event_datetime'] ?? '';
            if ($eventDateTime === '') {
                continue;
            }

            try {
                $sessionDate = new DateTimeImmutable($eventDateTime);
            } catch (Exception $e) {
                continue;
            }

            if (
                !labelIndicatesSunday($row['service_name'] ?? '') &&
                $sessionDate->format('N') !== '7'
            ) {
                continue;
            }

            if ($sessionDate > $today) {
                continue;
            }

            $dateKey = $sessionDate->format('Y-m-d');

            if (!isset($serviceOccurrences[$dateKey])) {
                $serviceOccurrences[$dateKey] = [
                    'date_obj' => $sessionDate,
                    'event_ids' => [],
                    'session_ids' => [],
                ];
            } elseif ($serviceOccurrences[$dateKey]['date_obj'] < $sessionDate) {
                $serviceOccurrences[$dateKey]['date_obj'] = $sessionDate;
            }

            $sessionId = (int) ($row['id'] ?? 0);
            if ($sessionId > 0) {
                $serviceOccurrences[$dateKey]['session_ids'][] = $sessionId;
                $sessionIdToDate[$sessionId] = $dateKey;
            }

            $eventId = (int) ($row['event_id'] ?? 0);
            if ($eventId > 0) {
                $eventIdToDate[$eventId] = $dateKey;
                if (!in_array($eventId, $serviceOccurrences[$dateKey]['event_ids'], true)) {
                    $serviceOccurrences[$dateKey]['event_ids'][] = $eventId;
                }
            }
        }

        if (empty($serviceOccurrences)) {
            $summary['note'] = 'No Sunday services found to evaluate inactivity.';
            return $summary;
        }

        // Sort by most recent date descending and limit to latest 16 Sundays (~4 months)
        krsort($serviceOccurrences);
        $orderedOccurrences = [];
        foreach ($serviceOccurrences as $dateKey => $info) {
            $orderedOccurrences[] = [
                'date' => $dateKey,
                'date_obj' => $info['date_obj'],
                'event_ids' => $info['event_ids'],
                'session_ids' => $info['session_ids'],
            ];
        }

        $orderedOccurrences = array_slice($orderedOccurrences, 0, 16);
        $summary['sunday_service_count'] = count($orderedOccurrences);
        $summary['has_sunday_services'] = $summary['sunday_service_count'] > 0;

        if ($summary['sunday_service_count'] === 0) {
            $summary['note'] = 'No recent Sunday services to evaluate inactivity.';
            return $summary;
        }

        // Build lookup of attendance per Sunday date
        $attendanceByDate = [];
        $eventIdsForQuery = [];
        $sessionIdsForQuery = [];

        foreach ($orderedOccurrences as $occurrence) {
            foreach ($occurrence['event_ids'] as $evtId) {
                $eventIdsForQuery[$evtId] = $occurrence['date'];
            }
            foreach ($occurrence['session_ids'] as $sessId) {
                $sessionIdsForQuery[$sessId] = $occurrence['date'];
            }
        }

        if (!empty($eventIdsForQuery)) {
            $eventIds = array_keys($eventIdsForQuery);
            if (count($eventIds) > 200) {
                $eventIds = array_slice($eventIds, 0, 200);
            }

            $placeholders = implode(',', array_fill(0, count($eventIds), '?'));
            $attendanceQuery = "SELECT event_id, member_id FROM attendance WHERE event_id IN ($placeholders) AND status IN ('present','late')";
            $attendanceStmt = $db->prepare($attendanceQuery);
            $attendanceStmt->execute($eventIds);

            while ($row = $attendanceStmt->fetch(PDO::FETCH_ASSOC)) {
                $eventId = (int) ($row['event_id'] ?? 0);
                $memberId = (int) ($row['member_id'] ?? 0);
                if ($eventId <= 0 || $memberId <= 0) {
                    continue;
                }

                $dateKey = $eventIdsForQuery[$eventId] ?? null;
                if ($dateKey === null) {
                    continue;
                }

                if (!isset($attendanceByDate[$dateKey])) {
                    $attendanceByDate[$dateKey] = [];
                }

                $attendanceByDate[$dateKey][$memberId] = true;
            }
        }

        if (!empty($sessionIdsForQuery)) {
            $sessionIds = array_keys($sessionIdsForQuery);
            if (count($sessionIds) > 200) {
                $sessionIds = array_slice($sessionIds, 0, 200);
            }

            $placeholders = implode(',', array_fill(0, count($sessionIds), '?'));
            $qrAttendanceQuery = "SELECT session_id, member_id FROM qr_attendance WHERE session_id IN ($placeholders) AND member_id IS NOT NULL";
            $qrAttendanceStmt = $db->prepare($qrAttendanceQuery);
            $qrAttendanceStmt->execute($sessionIds);

            while ($row = $qrAttendanceStmt->fetch(PDO::FETCH_ASSOC)) {
                $sessionId = (int) ($row['session_id'] ?? 0);
                $memberId = (int) ($row['member_id'] ?? 0);
                if ($sessionId <= 0 || $memberId <= 0) {
                    continue;
                }

                $dateKey = $sessionIdsForQuery[$sessionId] ?? null;
                if ($dateKey === null) {
                    continue;
                }

                if (!isset($attendanceByDate[$dateKey])) {
                    $attendanceByDate[$dateKey] = [];
                }

                $attendanceByDate[$dateKey][$memberId] = true;
            }
        }

        $summary['details_attendance_dates'] = array_keys($attendanceByDate);

        // Evaluate streak per active member
        $memberQuery = "SELECT id, first_name, middle_name, surname, created_at FROM members WHERE status = 'active'";
        $memberStmt = $db->prepare($memberQuery);
        $memberStmt->execute();

        $updateStmt = $db->prepare("UPDATE members SET status = 'inactive', updated_at = NOW() WHERE id = :member_id");

        while ($member = $memberStmt->fetch(PDO::FETCH_ASSOC)) {
            $summary['checked_members']++;

            $memberId = (int) ($member['id'] ?? 0);
            if ($memberId <= 0) {
                continue;
            }

            $memberNameParts = array_filter([
                $member['first_name'] ?? '',
                $member['middle_name'] ?? '',
                $member['surname'] ?? '',
            ]);
            $memberName = trim(implode(' ', $memberNameParts));

            $joinDateString = substr((string) ($member['created_at'] ?? ''), 0, 10);
            try {
                $joinDate = new DateTimeImmutable($joinDateString ?: '1970-01-01');
            } catch (Exception $e) {
                $joinDate = new DateTimeImmutable('1970-01-01');
            }

            $absentStreak = 0;
            $missedDates = [];

            foreach ($orderedOccurrences as $occurrence) {
                /** @var DateTimeImmutable $eventDate */
                $eventDate = $occurrence['date_obj'];
                $dateKey = $occurrence['date'];

                if ($eventDate < $joinDate) {
                    break; // Older than join date, no need to continue further back
                }

                if (isset($attendanceByDate[$dateKey][$memberId])) {
                    // Attended this Sunday service; reset streak and continue evaluating older dates.
                    $absentStreak = 0;
                    $missedDates = [];
                    continue;
                }

                $absentStreak++;
                $missedDates[] = $dateKey;

                if ($absentStreak >= 4) {
                    if ($updateStmt->execute([':member_id' => $memberId])) {
                        if ($updateStmt->rowCount() > 0) {
                            $summary['marked_inactive']++;

                            $detail = [
                                'member_id' => $memberId,
                                'member_name' => $memberName,
                                'missed_services' => $missedDates,
                            ];

                            $summary['details'][] = $detail;

                            if ($onMemberMarked !== null) {
                                $onMemberMarked($detail);
                            }
                        }
                    }
                    break;
                }
            }
        }

        return $summary;
    }
}

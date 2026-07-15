<?php
// Add CORS headers for cross-origin requests
header('Content-Type: application/json');

require_once '../config/database.php';
require_once __DIR__ . '/sunday_preset_helpers.php';

if (!function_exists('guest_compute_is_minor')) {
    function guest_compute_is_minor(?string $birthDateYmd): int
    {
        if ($birthDateYmd === null || trim($birthDateYmd) === '') {
            return 0;
        }

        try {
            $birth = new DateTimeImmutable($birthDateYmd);
            $today = new DateTimeImmutable('today');
            $age = $birth->diff($today)->y;

            return $age <= 17 ? 1 : 0;
        } catch (Exception $e) {
            return 0;
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        throw new InvalidArgumentException('Invalid request payload');
    }

    $sessionToken = trim($input['session_token'] ?? '');
    $eventIdDirect = isset($input['event_id']) ? intval($input['event_id']) : 0;
    $firstName = trim($input['first_name'] ?? '');
    $middleName = trim($input['middle_name'] ?? '');
    $surname = trim($input['surname'] ?? '');
    $suffix = trim($input['suffix'] ?? '');
    $contactNumber = trim($input['contact_number'] ?? '');
    $email = trim($input['email'] ?? '');
    $invitedByMemberId = null;
    $invitedByText = '';
    $notes = trim($input['notes'] ?? '');
    $source = trim($input['source'] ?? '');
    $attendanceStatus = strtolower(trim($input['status'] ?? 'present')) === 'late' ? 'late' : 'present';
    $isManagerManual = ($source === 'manual_manager');
    $birthDateInput = trim($input['birth_date'] ?? '');
    $explicitGuestId = isset($input['guest_id']) ? (int)$input['guest_id'] : 0;

    if (!$isManagerManual) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Guest check-in through QR is disabled. Please check in with church staff.'
        ]);
        exit();
    }

    if ($sessionToken === '' && $eventIdDirect <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Event ID is required'
        ]);
        exit();
    }

    if ($explicitGuestId <= 0) {
        if ($firstName === '' || $surname === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'First name and surname are required for new guests.'
            ]);
            exit();
        }

        if ($birthDateInput === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Birth date is required for new guests.'
            ]);
            exit();
        }
        try {
            $birthDateImmutable = new DateTimeImmutable($birthDateInput);
            $birthDateInput = $birthDateImmutable->format('Y-m-d');
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid birth date.'
            ]);
            exit();
        }
    }

    if ($contactNumber !== '') {
        $numericContact = preg_replace('/\D+/', '', $contactNumber);
        if (strlen($numericContact) !== 11) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Contact number must contain exactly 11 digits.'
            ]);
            exit();
        }
        $contactNumber = $numericContact;
    }

    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Please provide a valid email address.'
        ]);
        exit();
    }

    if ($suffix !== '' && strcasecmp($suffix, 'none') === 0) {
        $suffix = '';
    }

    $database = new Database();
    $db = $database->getConnection();

    try {
        $birthCol = $db->query("SHOW COLUMNS FROM guests LIKE 'birth_date'");
        if ($birthCol && $birthCol->rowCount() === 0) {
            $db->exec("ALTER TABLE guests ADD COLUMN birth_date DATE NULL AFTER email");
        }
        $minorCol = $db->query("SHOW COLUMNS FROM guests LIKE 'is_minor'");
        if ($minorCol && $minorCol->rowCount() === 0) {
            $db->exec("ALTER TABLE guests ADD COLUMN is_minor TINYINT(1) NOT NULL DEFAULT 0 AFTER birth_date");
        }
    } catch (Exception $schemaEx) {
        // ignore; insert will fail clearly if columns missing
    }

    $db->beginTransaction();

    // Fetch the guest session details — support both event_id direct and legacy session_token
    $session = null;
    $sessionId = 0;
    $eventId = null;

    if ($eventIdDirect > 0) {
        // New flow: event_id provided directly — create a synthetic session from the event
        $evtStmt = $db->prepare("SELECT id, title, date, start_time, status FROM events WHERE id = :id LIMIT 1");
        $evtStmt->bindValue(':id', $eventIdDirect, PDO::PARAM_INT);
        $evtStmt->execute();
        $evt = $evtStmt->fetch(PDO::FETCH_ASSOC);

        if (!$evt) {
            $db->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Event not found.']);
            exit();
        }

        if ($evt['status'] === 'completed') {
            $db->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'This event is already completed.']);
            exit();
        }

        // Build a synthetic session array so the rest of the code works unchanged
        $session = [
            'id'             => 0,   // no real qr_session row
            'event_id'       => (int)$evt['id'],
            'service_name'   => $evt['title'],
            'event_datetime' => $evt['date'] . ' ' . ($evt['start_time'] ?? '00:00:00'),
            'event_type'     => 'manual',
            'status'         => 'active',
            'session_type'   => 'guest',
        ];
        $sessionId  = 0;
        $eventId    = (int)$evt['id'];
    } else {
        // Legacy flow: session_token
        $sessionStmt = $db->prepare("SELECT id, event_id, service_name, event_datetime, event_type, status, session_type FROM qr_sessions WHERE session_token = :token LIMIT 1");
        $sessionStmt->bindParam(':token', $sessionToken);
        $sessionStmt->execute();
        $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

        if (!$session) {
            $db->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Invalid or expired guest QR code.']);
            exit();
        }

        if ($session['status'] !== 'active') {
            $db->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'This guest QR code session is no longer active.',
                'data' => ['status' => $session['status']]
            ]);
            exit();
        }

        $sessionId = (int)$session['id'];
        $eventId   = !empty($session['event_id']) ? (int)$session['event_id'] : null;
    }

    try {
        $eventDateTime = new DateTimeImmutable($session['event_datetime'] ?? 'now');
    } catch (Exception $e) {
        $eventDateTime = new DateTimeImmutable();
    }
    $visitDate = $eventDateTime->format('Y-m-d');

    $guest = null;
    if ($explicitGuestId > 0) {
        $gidStmt = $db->prepare("SELECT * FROM guests WHERE id = :id AND status = 'active' LIMIT 1");
        $gidStmt->bindValue(':id', $explicitGuestId, PDO::PARAM_INT);
        $gidStmt->execute();
        $guest = $gidStmt->fetch(PDO::FETCH_ASSOC);

        if (!$guest) {
            $db->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Guest not found or no longer active.'
            ]);
            exit();
        }

        $firstName = trim((string)($guest['first_name'] ?? ''));
        $middleName = trim((string)($guest['middle_name'] ?? ''));
        $surname = trim((string)($guest['surname'] ?? ''));
        $suffix = trim((string)($guest['suffix'] ?? ''));
        $contactNumber = trim((string)($guest['contact_number'] ?? ''));
        $email = trim((string)($guest['email'] ?? ''));

        $birthDateInput = trim((string)($guest['birth_date'] ?? ''));
        if ($birthDateInput === '') {
            $db->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'This guest record has no birth date. Complete their profile first or use New guest.'
            ]);
            exit();
        }

        try {
            $birthDateImmutable = new DateTimeImmutable($birthDateInput);
            $birthDateInput = $birthDateImmutable->format('Y-m-d');
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Stored birth date for this guest is invalid.'
            ]);
            exit();
        }
    }

    $nameParts = array_filter([$firstName, $middleName, $surname, $suffix], static function ($part) {
        return $part !== null && trim($part) !== '';
    });
    $fullName = trim(preg_replace('/\s+/', ' ', implode(' ', $nameParts)));

    // Normalize name for comparison (lowercase, remove extra spaces, remove special chars)
    $normalizeName = function($name) {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', preg_replace('/[^\p{L}\p{N}\s]/u', '', $name))));
    };
    
    $normalizedFirstName = $normalizeName($firstName);
    $normalizedSurname = $normalizeName($surname);
    $normalizedFullName = $normalizeName($fullName);

    // Guard: prevent members from checking in as guests by matching name against members table
    if ($normalizedFirstName && $normalizedSurname) {
        $lenFirst = strlen($firstName);
        $lenSurname = strlen($surname);

        $memberMatchStmt = $db->prepare(
            "SELECT id, first_name, middle_name, surname, status
             FROM members
             WHERE first_name IS NOT NULL
               AND surname IS NOT NULL
               AND CHAR_LENGTH(first_name) BETWEEN :len_first_min AND :len_first_max
               AND CHAR_LENGTH(surname) BETWEEN :len_surname_min AND :len_surname_max
             LIMIT 150"
        );
        $memberMatchStmt->bindValue(':len_first_min', max(1, $lenFirst - 2), PDO::PARAM_INT);
        $memberMatchStmt->bindValue(':len_first_max', $lenFirst + 2, PDO::PARAM_INT);
        $memberMatchStmt->bindValue(':len_surname_min', max(1, $lenSurname - 2), PDO::PARAM_INT);
        $memberMatchStmt->bindValue(':len_surname_max', $lenSurname + 2, PDO::PARAM_INT);
        $memberMatchStmt->execute();
        $memberCandidates = $memberMatchStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($memberCandidates as $memberRow) {
            $memberFirst = $normalizeName($memberRow['first_name'] ?? '');
            $memberSurname = $normalizeName($memberRow['surname'] ?? '');

            if ($memberFirst === $normalizedFirstName && $memberSurname === $normalizedSurname) {
                $db->rollBack();
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'This information matches an existing member. Please log in as a member to check in.'
                ]);
                exit();
            }
        }
    }

    if ($explicitGuestId <= 0) {
        $guest = null;
    }

    // Priority 1: Match by normalized first name + surname (most reliable)
    // Use BINARY comparison to avoid collation issues, or fetch and filter in PHP
    if (!$guest && $normalizedFirstName && $normalizedSurname) {
        // Try exact match first (case-sensitive to avoid collation)
        $nameMatchQuery = "SELECT * FROM guests WHERE BINARY first_name = :first_name AND BINARY surname = :surname LIMIT 1";
        $nameMatchStmt = $db->prepare($nameMatchQuery);
        $nameMatchStmt->bindValue(':first_name', $firstName); // Use original, not normalized
        $nameMatchStmt->bindValue(':surname', $surname);
        $nameMatchStmt->execute();
        $guest = $nameMatchStmt->fetch(PDO::FETCH_ASSOC);
        
        // If no exact match, try case-insensitive by fetching candidates and filtering in PHP
        if (!$guest) {
            // Get candidates with similar length names to reduce dataset
            $lenFirst = strlen($firstName);
            $lenSurname = strlen($surname);
            $nameMatchQuery = "SELECT * FROM guests 
                              WHERE CHAR_LENGTH(first_name) BETWEEN :len_first_min AND :len_first_max
                                AND CHAR_LENGTH(surname) BETWEEN :len_surname_min AND :len_surname_max
                              LIMIT 100";
            $nameMatchStmt = $db->prepare($nameMatchQuery);
            $nameMatchStmt->bindValue(':len_first_min', max(1, $lenFirst - 2), PDO::PARAM_INT);
            $nameMatchStmt->bindValue(':len_first_max', $lenFirst + 2, PDO::PARAM_INT);
            $nameMatchStmt->bindValue(':len_surname_min', max(1, $lenSurname - 2), PDO::PARAM_INT);
            $nameMatchStmt->bindValue(':len_surname_max', $lenSurname + 2, PDO::PARAM_INT);
            $nameMatchStmt->execute();
            $candidates = $nameMatchStmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($candidates as $g) {
                $gFirstName = mb_strtolower(trim($g['first_name'] ?? ''));
                $gSurname = mb_strtolower(trim($g['surname'] ?? ''));
                if ($gFirstName === $normalizedFirstName && $gSurname === $normalizedSurname) {
                    $guest = $g;
                    break;
                }
            }
        }
    }

    // Priority 2: Match by normalized full name (fallback)
    if (!$guest && $normalizedFullName) {
        $fullNameLen = strlen($fullName);
        $fullNameQuery = "SELECT * FROM guests 
                         WHERE CHAR_LENGTH(full_name) BETWEEN :len_min AND :len_max
                         LIMIT 100";
        $fullNameStmt = $db->prepare($fullNameQuery);
        $fullNameStmt->bindValue(':len_min', max(1, $fullNameLen - 5), PDO::PARAM_INT);
        $fullNameStmt->bindValue(':len_max', $fullNameLen + 5, PDO::PARAM_INT);
        $fullNameStmt->execute();
        $candidates = $fullNameStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($candidates as $g) {
            $gFullName = mb_strtolower(trim(preg_replace('/[.,]/', '', $g['full_name'] ?? '')));
            if ($gFullName === $normalizedFullName) {
                $guest = $g;
                break;
            }
        }
    }

    // Priority 3: Match by email (if provided, as secondary check)
    if (!$guest && $email !== '') {
        $guestLookup = $db->prepare('SELECT * FROM guests WHERE email = :email LIMIT 1');
        $guestLookup->bindParam(':email', $email);
        $guestLookup->execute();
        $guest = $guestLookup->fetch(PDO::FETCH_ASSOC);
    }

    $isNewGuest = false;
    $guestId = null;

    $effectiveBirthDate = $isManagerManual ? $birthDateInput : null;
    if (!$isManagerManual && $guest && !empty($guest['birth_date'])) {
        $effectiveBirthDate = $guest['birth_date'];
    }
    $effectiveIsMinor = guest_compute_is_minor($effectiveBirthDate);

    if ($guest) {
        $guestId = (int) $guest['id'];

        $updateGuest = $db->prepare(
            "UPDATE guests
             SET first_name = :first_name,
                 middle_name = :middle_name,
                 surname = :surname,
                 suffix = :suffix,
                 full_name = :full_name,
                 contact_number = :contact,
                 email = CASE WHEN :guest_email <> '' THEN :guest_email ELSE email END,
                 birth_date = CASE WHEN :manual_mgr_flag = 1 THEN :birth_date_manual ELSE birth_date END,
                 is_minor = CASE WHEN :manual_mgr_flag = 1 THEN :is_minor_manual ELSE is_minor END,
                 invited_by_member_id = NULL,
                 invited_by_text = NULL,
                 notes = CASE WHEN :notes <> '' THEN :notes ELSE notes END,
                 first_visit_date = CASE WHEN first_visit_date IS NULL THEN :first_visit ELSE first_visit_date END,
                 last_visit_date = :last_visit,
                 status = 'active',
                 updated_at = NOW()
             WHERE id = :guest_id"
        );

        $manualMgrFlag = $isManagerManual ? 1 : 0;

        $updateGuest->bindValue(':first_name', $firstName);
        $updateGuest->bindValue(':middle_name', $middleName !== '' ? $middleName : null, $middleName !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':surname', $surname);
        $updateGuest->bindValue(':suffix', $suffix !== '' ? $suffix : null, $suffix !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':full_name', $fullName);
        $updateGuest->bindValue(':contact', $contactNumber !== '' ? $contactNumber : null, $contactNumber !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':guest_email', $email);
        $updateGuest->bindValue(':manual_mgr_flag', $manualMgrFlag, PDO::PARAM_INT);
        $updateGuest->bindValue(':birth_date_manual', $effectiveBirthDate, $effectiveBirthDate !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':is_minor_manual', $effectiveIsMinor, PDO::PARAM_INT);
        $updateGuest->bindValue(':notes', $notes);
        $updateGuest->bindValue(':first_visit', $visitDate);
        $updateGuest->bindValue(':last_visit', $visitDate);
        $updateGuest->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
        $updateGuest->execute();
    } else {
        $isNewGuest = true;

        $insertGuest = $db->prepare(
            "INSERT INTO guests
                (first_name, middle_name, surname, suffix, full_name, contact_number, email, birth_date, is_minor, notes, first_visit_date, last_visit_date, status)
             VALUES
                (:first_name, :middle_name, :surname, :suffix, :full_name, :contact, :email, :birth_date, :is_minor, :notes, :first_visit, :last_visit, 'active')"
        );

        $insertGuest->bindValue(':first_name', $firstName);
        $insertGuest->bindValue(':middle_name', $middleName !== '' ? $middleName : null, $middleName !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':surname', $surname);
        $insertGuest->bindValue(':suffix', $suffix !== '' ? $suffix : null, $suffix !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':full_name', $fullName);
        $insertGuest->bindValue(':contact', $contactNumber !== '' ? $contactNumber : null, $contactNumber !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':email', $email !== '' ? $email : null, $email !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':birth_date', $effectiveBirthDate !== null ? $effectiveBirthDate : null, $effectiveBirthDate !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':is_minor', $effectiveIsMinor, PDO::PARAM_INT);
        $insertGuest->bindValue(':notes', $notes !== '' ? $notes : null, $notes !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':first_visit', $visitDate);
        $insertGuest->bindValue(':last_visit', $visitDate);
        $insertGuest->execute();

        $guestId = (int) $db->lastInsertId();
    }

    // Prevent duplicate check-ins for the same guest & event/session
    if ($guestId) {
        if ($sessionId > 0) {
            $duplicateCheck = $db->prepare('SELECT id FROM guest_attendance WHERE guest_id = :guest_id AND session_id = :session_id LIMIT 1');
            $duplicateCheck->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
            $duplicateCheck->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
        } else {
            $duplicateCheck = $db->prepare('SELECT id FROM guest_attendance WHERE guest_id = :guest_id AND event_id = :event_id LIMIT 1');
            $duplicateCheck->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
            $duplicateCheck->bindValue(':event_id', $eventId, PDO::PARAM_INT);
        }
        $duplicateCheck->execute();

        if ($duplicateCheck->fetch()) {
            $db->rollBack();
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'This guest has already been checked in for this event.',
                'data' => ['guest_id' => $guestId, 'duplicate' => true]
            ]);
            exit();
        }
    }

    // Check 2: By name for same session/event
    if ($normalizedFirstName && $normalizedSurname) {
        if ($sessionId > 0) {
            $nameDuplicateCheck = $db->prepare(
                "SELECT ga.id, g.first_name, g.surname FROM guest_attendance ga
                 INNER JOIN guests g ON ga.guest_id = g.id
                 WHERE ga.session_id = :session_id"
            );
            $nameDuplicateCheck->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
        } else {
            $nameDuplicateCheck = $db->prepare(
                "SELECT ga.id, g.first_name, g.surname FROM guest_attendance ga
                 INNER JOIN guests g ON ga.guest_id = g.id
                 WHERE ga.event_id = :event_id"
            );
            $nameDuplicateCheck->bindValue(':event_id', $eventId, PDO::PARAM_INT);
        }
        $nameDuplicateCheck->execute();
        $existingAttendances = $nameDuplicateCheck->fetchAll(PDO::FETCH_ASSOC);

        foreach ($existingAttendances as $attendance) {
            $existingFirstName = mb_strtolower(trim($attendance['first_name'] ?? ''));
            $existingSurname   = mb_strtolower(trim($attendance['surname']  ?? ''));
            if ($existingFirstName === $normalizedFirstName && $existingSurname === $normalizedSurname) {
                $db->rollBack();
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'A guest with this name has already been checked in for this event.',
                    'data'    => ['duplicate' => true, 'basis' => 'name']
                ]);
                exit();
            }
        }
    }

    $attendanceInsert = $db->prepare(
        "INSERT INTO guest_attendance (guest_id, session_id, event_id, status, checkin_time, source, notes)
         VALUES (:guest_id, :session_id, :event_id, :status, NOW(), :source, :notes)"
    );
    $attendanceInsert->bindValue(':guest_id',   $guestId,   PDO::PARAM_INT);
    $attendanceInsert->bindValue(':session_id', $sessionId > 0 ? $sessionId : null, $sessionId > 0 ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $attendanceInsert->bindValue(':event_id',   $eventId,   $eventId !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $attendanceInsert->bindValue(':status', $attendanceStatus);
    $attendanceDbSource = $isManagerManual ? 'manual' : (($source !== '' && strtolower($source) === 'manual') ? 'manual' : 'qr');
    $attendanceInsert->bindValue(':source', $attendanceDbSource);
    $attendanceInsert->bindValue(':notes', $notes !== '' ? $notes : null, $notes !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
    $attendanceInsert->execute();

    $attendanceId = (int) $db->lastInsertId();

    if ($sessionId > 0) {
        $updateScanCount = $db->prepare('UPDATE qr_sessions SET scan_count = scan_count + 1 WHERE id = :session_id');
        $updateScanCount->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
        $updateScanCount->execute();
    }

    $db->commit();

    // Attendance summary
    $totalVisitsStmt = $db->prepare('SELECT COUNT(*) FROM guest_attendance WHERE guest_id = :guest_id');
    $totalVisitsStmt->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
    $totalVisitsStmt->execute();
    $totalVisits = (int) $totalVisitsStmt->fetchColumn();

    // Get current session/event date first
    $currentSessionDate = null;
    try {
        $sessionDateTime = $session['event_datetime'] ?? null;
        if ($sessionDateTime) {
            $currentSessionDate = new DateTimeImmutable($sessionDateTime);
        }
    } catch (Exception $e) {
        // Ignore
    }
    
    // Preset "Sunday Service" QR sessions only (not custom events with the same name)
    $sundayStmt = $db->prepare(
        "SELECT
            DATE(COALESCE(qs.event_datetime, ga.checkin_time)) AS event_date,
            COALESCE(qs.event_datetime, CONCAT(e.date, ' ', COALESCE(NULLIF(TRIM(e.start_time), ''), '00:00:00')), ga.checkin_time) AS event_datetime_full,
            qs.service_name,
            qs.event_type AS session_event_type,
            ga.checkin_time
         FROM guest_attendance ga
         LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
         LEFT JOIN events e ON (ga.event_id = e.id OR qs.event_id = e.id)
         WHERE ga.guest_id = :guest_id"
    );
    $sundayStmt->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
    $sundayStmt->execute();
    $allAttendanceRows = $sundayStmt->fetchAll(PDO::FETCH_ASSOC);

    $presetSundayRows = [];
    foreach ($allAttendanceRows as $row) {
        if (guest_attendance_row_is_preset_sunday($row)) {
            $presetSundayRows[] = $row;
        }
    }

    $isSundayService = guest_qr_session_is_preset_sunday_service(
        $session['service_name'] ?? null,
        $session['event_type'] ?? null
    );

    if ($isSundayService && $currentSessionDate) {
        $currentDateStr = $currentSessionDate->format('Y-m-d');
        $hasCurrentDate = false;
        foreach ($presetSundayRows as $row) {
            if (!empty($row['event_date']) && $row['event_date'] === $currentDateStr) {
                $hasCurrentDate = true;
                break;
            }
        }
        if (!$hasCurrentDate) {
            array_unshift($presetSundayRows, [
                'event_date' => $currentDateStr,
                'event_datetime_full' => $session['event_datetime'] ?? $currentSessionDate->format('Y-m-d H:i:s'),
                'service_name' => $session['service_name'],
                'session_event_type' => $session['event_type']
            ]);
        }
    }

    // Distinct preset Sunday Service dates (_membership_: 4 total, not consecutive)
    $presetSundayDistinctDates = [];
    foreach ($presetSundayRows as $row) {
        if (empty($row['event_date'])) {
            continue;
        }
        try {
            $presetSundayDistinctDates[(new DateTimeImmutable($row['event_date']))->format('Y-m-d')] = true;
        } catch (Exception $e) {
            continue;
        }
    }
    $presetSundayDistinctCount = count($presetSundayDistinctDates);

    // Consecutive streak (informational); membership uses presetSundayDistinctCount
    $sortedSundayDatesDesc = array_keys($presetSundayDistinctDates);
    rsort($sortedSundayDatesDesc, SORT_STRING);
    $sundayDateObjects = array_map(static function ($d) {
        try {
            return new DateTimeImmutable($d);
        } catch (Exception $e) {
            return null;
        }
    }, $sortedSundayDatesDesc);
    $sundayDateObjects = array_values(array_filter($sundayDateObjects));

    $sundayStreak = 0;
    if (!empty($sundayDateObjects)) {
        $sundayStreak = 1;
        for ($i = 1; $i < count($sundayDateObjects); $i++) {
            $moreRecentDate = $sundayDateObjects[$i - 1];
            $olderDate = $sundayDateObjects[$i];
            $diffDays = (int) $moreRecentDate->diff($olderDate)->days;
            if ($diffDays >= 6 && $diffDays <= 8) {
                $sundayStreak++;
            } else {
                break;
            }
        }
    }

    $effectiveStreak = $sundayStreak;

    $debugStreakDates = array_slice($sortedSundayDatesDesc, 0, 5);

    $remainingForMembership = max(0, 4 - min(4, $presetSundayDistinctCount));

    // Check if guest is already converted/archived
    $guestStatusCheck = $db->prepare("SELECT status FROM guests WHERE id = :guest_id");
    $guestStatusCheck->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
    $guestStatusCheck->execute();
    $guestStatus = $guestStatusCheck->fetchColumn();
    $isGuestActive = strtolower($guestStatus ?? 'active') === 'active';
    
    // Check if guest is already a member (to avoid showing form to converted guests)
    // Get guest contact info first, then check members
    $guestInfoQuery = $db->prepare("SELECT contact_number, email FROM guests WHERE id = :guest_id");
    $guestInfoQuery->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
    $guestInfoQuery->execute();
    $guestInfo = $guestInfoQuery->fetch(PDO::FETCH_ASSOC);
    
    $isAlreadyMember = false;
    if ($guestInfo) {
        $guestContact = $guestInfo['contact_number'] ?? '';
        $guestEmail = $guestInfo['email'] ?? '';
        
        if ($guestContact) {
            $memberCheck = $db->prepare("SELECT id FROM members WHERE contact_number = :contact_number LIMIT 1");
            $memberCheck->bindValue(':contact_number', $guestContact);
            $memberCheck->execute();
            if ($memberCheck->fetch()) {
                $isAlreadyMember = true;
            }
        }
        
        if (!$isAlreadyMember && $guestEmail) {
            $memberCheck = $db->prepare("SELECT id FROM members WHERE email = :email LIMIT 1");
            $memberCheck->bindValue(':email', $guestEmail);
            $memberCheck->execute();
            if ($memberCheck->fetch()) {
                $isAlreadyMember = true;
            }
        }
    }
    
    $readyForMembership = $isGuestActive
        && !$isAlreadyMember
        && $presetSundayDistinctCount >= 4;

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Guest check-in recorded successfully.',
        'data' => [
            'guest_id' => $guestId,
            'guest_name' => $fullName,
            'attendance_id' => $attendanceId,
            'is_new_guest' => $isNewGuest,
            'total_visits' => $totalVisits,
            'sunday_streak' => $sundayStreak,
            'effective_sunday_streak' => $effectiveStreak,
            'remaining_for_membership' => $remainingForMembership,
            'ready_for_membership' => $readyForMembership,
            'service_name' => $session['service_name'],
            'event_datetime' => $session['event_datetime'],
            'status' => $attendanceStatus,
            'preset_sunday_distinct_count' => $presetSundayDistinctCount,
            'debug_info' => [
                'is_sunday_service' => $isSundayService,
                'is_guest_active' => $isGuestActive,
                'is_already_member' => $isAlreadyMember,
                'preset_sunday_distinct_count' => $presetSundayDistinctCount,
                'sunday_dates_count' => count($sundayDateObjects),
                'sunday_streak' => $sundayStreak,
                'effective_streak' => $effectiveStreak,
                'guest_status' => $guestStatus,
                'recent_preset_sunday_dates' => $debugStreakDates,
                'has_enough_sundays' => $presetSundayDistinctCount >= 4
            ]
        ]
    ]);

} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'Guest has already been checked in for this session.',
            'data' => [
                'duplicate' => true
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

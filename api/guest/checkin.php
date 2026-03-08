<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

require_once '../config/database.php';

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

if (!function_exists('dateStringIsSunday')) {
    function dateStringIsSunday(?string $value): bool
    {
        if ($value === null || trim($value) === '') {
            return false;
        }

        try {
            $date = new DateTimeImmutable($value);
            return $date->format('N') === '7';
        } catch (Exception $e) {
            return false;
        }
    }
}

if (!function_exists('tryCreateDate')) {
    function tryCreateDate(?string $value): ?DateTimeImmutable
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($value);
        } catch (Exception $e) {
            return null;
        }
    }
}

if (!function_exists('deriveAttendanceDate')) {
    function deriveAttendanceDate(array $row): ?DateTimeImmutable
    {
        $candidates = [
            $row['event_datetime_full'] ?? null,
            $row['event_date'] ?? null,
            $row['checkin_time'] ?? null
        ];

        foreach ($candidates as $candidate) {
            $date = tryCreateDate($candidate);
            if ($date) {
                return $date;
            }
        }

        return null;
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
    $firstName = trim($input['first_name'] ?? '');
    $middleName = trim($input['middle_name'] ?? '');
    $surname = trim($input['surname'] ?? '');
    $suffix = trim($input['suffix'] ?? '');
    $contactNumber = trim($input['contact_number'] ?? '');
    $email = trim($input['email'] ?? '');
    $invitedByMemberId = null;
    $invitedByText = '';
    $notes = trim($input['notes'] ?? '');
    $source = trim($input['source'] ?? 'qr');
    $attendanceStatus = strtolower(trim($input['status'] ?? 'present')) === 'late' ? 'late' : 'present';

    if ($sessionToken === '' || $firstName === '' || $surname === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Session token, first name, and surname are required'
        ]);
        exit();
    }

    if ($contactNumber === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Please provide a contact number.'
        ]);
        exit();
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

    if ($suffix !== '' && strcasecmp($suffix, 'none') === 0) {
        $suffix = '';
    }

    if ($source === '') {
        $source = 'qr';
    }

    $database = new Database();
    $db = $database->getConnection();

    $db->beginTransaction();

    // Fetch the guest session details
    $sessionStmt = $db->prepare("SELECT id, event_id, service_name, event_datetime, status, session_type FROM qr_sessions WHERE session_token = :token LIMIT 1");
    $sessionStmt->bindParam(':token', $sessionToken);
    $sessionStmt->execute();
    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or expired guest QR code.'
        ]);
        exit();
    }

    // Unified QR - accept guest check-ins on any session
    // No session_type restriction needed for unified QR codes

    if ($session['status'] !== 'active') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This guest QR code session is no longer active.',
            'data' => [
                'status' => $session['status']
            ]
        ]);
        exit();
    }

    $sessionId = (int) $session['id'];
    $eventId = !empty($session['event_id']) ? (int) $session['event_id'] : null;

    try {
        $eventDateTime = new DateTimeImmutable($session['event_datetime'] ?? 'now');
    } catch (Exception $e) {
        $eventDateTime = new DateTimeImmutable();
    }
    $visitDate = $eventDateTime->format('Y-m-d');

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

    $guest = null;

    // Priority 1: Match by normalized first name + surname (most reliable)
    // Use BINARY comparison to avoid collation issues, or fetch and filter in PHP
    if ($normalizedFirstName && $normalizedSurname) {
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
                 email = :email,
                 invited_by_member_id = NULL,
                 invited_by_text = NULL,
                 notes = CASE WHEN :notes <> '' THEN :notes ELSE notes END,
                 first_visit_date = CASE WHEN first_visit_date IS NULL THEN :first_visit ELSE first_visit_date END,
                 last_visit_date = :last_visit,
                 status = 'active',
                 updated_at = NOW()
             WHERE id = :guest_id"
        );

        $updateGuest->bindValue(':first_name', $firstName);
        $updateGuest->bindValue(':middle_name', $middleName !== '' ? $middleName : null, $middleName !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':surname', $surname);
        $updateGuest->bindValue(':suffix', $suffix !== '' ? $suffix : null, $suffix !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':full_name', $fullName);
        $updateGuest->bindValue(':contact', $contactNumber !== '' ? $contactNumber : null, $contactNumber !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':email', $email !== '' ? $email : null, $email !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $updateGuest->bindValue(':notes', $notes);
        $updateGuest->bindValue(':first_visit', $visitDate);
        $updateGuest->bindValue(':last_visit', $visitDate);
        $updateGuest->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
        $updateGuest->execute();
    } else {
        $isNewGuest = true;

        $insertGuest = $db->prepare(
            "INSERT INTO guests
                (first_name, middle_name, surname, suffix, full_name, contact_number, email, notes, first_visit_date, last_visit_date, status)
             VALUES
                (:first_name, :middle_name, :surname, :suffix, :full_name, :contact, :email, :notes, :first_visit, :last_visit, 'active')"
        );

        $insertGuest->bindValue(':first_name', $firstName);
        $insertGuest->bindValue(':middle_name', $middleName !== '' ? $middleName : null, $middleName !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':surname', $surname);
        $insertGuest->bindValue(':suffix', $suffix !== '' ? $suffix : null, $suffix !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':full_name', $fullName);
        $insertGuest->bindValue(':contact', $contactNumber !== '' ? $contactNumber : null, $contactNumber !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':email', $email !== '' ? $email : null, $email !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':notes', $notes !== '' ? $notes : null, $notes !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $insertGuest->bindValue(':first_visit', $visitDate);
        $insertGuest->bindValue(':last_visit', $visitDate);
        $insertGuest->execute();

        $guestId = (int) $db->lastInsertId();
    }

    // Prevent duplicate check-ins for the same guest & session
    // Check 1: By guest_id + session_id (if guest was found/created)
    if ($guestId) {
        $duplicateCheck = $db->prepare('SELECT id FROM guest_attendance WHERE guest_id = :guest_id AND session_id = :session_id LIMIT 1');
        $duplicateCheck->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
        $duplicateCheck->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
        $duplicateCheck->execute();

        if ($duplicateCheck->fetch()) {
            $db->rollBack();
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'This guest has already been checked in for this event.',
                'data' => [
                    'guest_id' => $guestId,
                    'duplicate' => true
                ]
            ]);
            exit();
        }
    }

    // Check 2: By name matching for the same session (additional protection)
    // This catches cases where same name tries to check in again even if guest_id differs
    if ($normalizedFirstName && $normalizedSurname) {
        // Fetch all guest attendances for this session and check in PHP to avoid collation issues
        $nameDuplicateCheck = $db->prepare(
            "SELECT ga.id, g.first_name, g.surname
             FROM guest_attendance ga
             INNER JOIN guests g ON ga.guest_id = g.id
             WHERE ga.session_id = :session_id"
        );
        $nameDuplicateCheck->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
        $nameDuplicateCheck->execute();
        $existingAttendances = $nameDuplicateCheck->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($existingAttendances as $attendance) {
            $existingFirstName = mb_strtolower(trim($attendance['first_name'] ?? ''));
            $existingSurname = mb_strtolower(trim($attendance['surname'] ?? ''));
            if ($existingFirstName === $normalizedFirstName && $existingSurname === $normalizedSurname) {
                $db->rollBack();
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'A guest with this name has already been checked in for this event.',
                    'data' => [
                        'duplicate' => true,
                        'basis' => 'name'
                    ]
                ]);
                exit();
            }
        }
    }

    $attendanceInsert = $db->prepare(
        "INSERT INTO guest_attendance (guest_id, session_id, event_id, status, checkin_time, source, notes)
         VALUES (:guest_id, :session_id, :event_id, :status, NOW(), :source, :notes)"
    );
    $attendanceInsert->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
    $attendanceInsert->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
    $attendanceInsert->bindValue(':event_id', $eventId, $eventId !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $attendanceInsert->bindValue(':status', $attendanceStatus);
    $attendanceInsert->bindValue(':source', $source !== '' ? $source : 'qr');
    $attendanceInsert->bindValue(':notes', $notes !== '' ? $notes : null, $notes !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL);
    $attendanceInsert->execute();

    $attendanceId = (int) $db->lastInsertId();

    $updateScanCount = $db->prepare('UPDATE qr_sessions SET scan_count = scan_count + 1 WHERE id = :session_id');
    $updateScanCount->bindValue(':session_id', $sessionId, PDO::PARAM_INT);
    $updateScanCount->execute();

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
    
    // Get all Sunday service attendances for this guest
    // Check both via qr_sessions and via events table
    // Fetch all attendances first, then filter in PHP to avoid collation issues
    $sundayStmt = $db->prepare(
        "SELECT DISTINCT 
            COALESCE(DATE(qs.event_datetime), DATE(e.date), DATE(ga.checkin_time)) AS event_date,
            COALESCE(qs.event_datetime, CONCAT(e.date, ' ', e.start_time), ga.checkin_time) AS event_datetime_full,
            qs.service_name,
            e.title AS event_title,
            e.event_type,
            ga.checkin_time
         FROM guest_attendance ga
         LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
         LEFT JOIN events e ON (ga.event_id = e.id OR qs.event_id = e.id)
         WHERE ga.guest_id = :guest_id
         ORDER BY event_datetime_full DESC"
    );
    $sundayStmt->bindValue(':guest_id', $guestId, PDO::PARAM_INT);
    $sundayStmt->execute();
    $allRows = $sundayStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Filter for Sunday services in PHP to avoid collation issues
    $sundayRows = [];
    foreach ($allRows as $row) {
        if (
            labelIndicatesSunday($row['service_name'] ?? '') ||
            labelIndicatesSunday($row['event_title'] ?? '') ||
            labelIndicatesSunday($row['event_type'] ?? '') ||
            dateStringIsSunday($row['event_date'] ?? '') ||
            dateStringIsSunday($row['event_datetime_full'] ?? '')
        ) {
            $sundayRows[] = $row;
        }
    }
    
    // Check if this is a Sunday service
    $isSundayService = labelIndicatesSunday($session['service_name'] ?? '')
        || labelIndicatesSunday($session['session_type'] ?? '')
        || labelIndicatesSunday($session['event_type'] ?? '')
        || dateStringIsSunday($session['event_datetime'] ?? '')
        || dateStringIsSunday($session['event_date'] ?? '')
        || dateStringIsSunday($session['checkin_time'] ?? '');

    // Also check if current session is linked to a Sunday service event
    if (!$isSundayService && $eventId) {
        $eventCheck = $db->prepare("SELECT title, event_type FROM events WHERE id = :event_id");
        $eventCheck->bindValue(':event_id', $eventId, PDO::PARAM_INT);
        $eventCheck->execute();
        $eventRow = $eventCheck->fetch(PDO::FETCH_ASSOC);
        if ($eventRow) {
            if (labelIndicatesSunday($eventRow['title'] ?? '') || labelIndicatesSunday($eventRow['event_type'] ?? '')) {
                $isSundayService = true;
            }
        }
    }
    
    // Also add current check-in if it's a Sunday service (to ensure it's counted in streak)
    if ($isSundayService && $currentSessionDate) {
        $currentDateStr = $currentSessionDate->format('Y-m-d');
        $hasCurrentDate = false;
        foreach ($sundayRows as $row) {
            if (!empty($row['event_date']) && $row['event_date'] === $currentDateStr) {
                $hasCurrentDate = true;
                break;
            }
        }
        // If current date is not in the results, add it manually to ensure it's counted
        if (!$hasCurrentDate) {
            array_unshift($sundayRows, [
                'event_date' => $currentDateStr,
                'event_datetime_full' => $session['event_datetime'] ?? $currentSessionDate->format('Y-m-d H:i:s'),
                'service_name' => $session['service_name'] ?? 'Sunday Service',
                'event_title' => null,
                'event_type' => null
            ]);
        }
    }
    
    // Calculate consecutive Sunday streak
    // IMPORTANT: The current check-in is already in the database (committed), so the query includes it
    $sundayStreak = 0;
    $uniqueDates = [];
    $sundayDateObjects = [];
    
    // Collect all unique Sunday dates as DateTimeImmutable objects
    foreach ($sundayRows as $row) {
        if (empty($row['event_date'])) {
            continue;
        }
        try {
            $dateObj = new DateTimeImmutable($row['event_date']);
            $dateStr = $dateObj->format('Y-m-d');
            
            // Store unique dates only (avoid duplicates)
            if (!in_array($dateStr, $uniqueDates, true)) {
                $uniqueDates[] = $dateStr;
                $sundayDateObjects[] = $dateObj;
            }
        } catch (Exception $e) {
            continue;
        }
    }
    
    // Sort dates in descending order (most recent first)
    usort($sundayDateObjects, function($a, $b) {
        return $b <=> $a;
    });
    
    // Calculate consecutive streak starting from most recent Sunday
    // We go backwards in time, checking if each Sunday is approximately 7 days before the previous one
    if (!empty($sundayDateObjects)) {
        $sundayStreak = 1; // Start with the most recent Sunday (index 0)
        
        // Check backwards in time for consecutive Sundays
        for ($i = 1; $i < count($sundayDateObjects); $i++) {
            $moreRecentDate = $sundayDateObjects[$i - 1]; // The Sunday we already counted
            $olderDate = $sundayDateObjects[$i]; // The next Sunday to check
            
            // Calculate days between the two Sundays
            // Since we're going backwards, olderDate is earlier, moreRecentDate is later
            $diff = $moreRecentDate->diff($olderDate);
            $diffDays = (int) $diff->days;
            
            // For consecutive Sundays, they should be approximately 7 days apart
            // Allow 6-8 days for flexibility (handles edge cases around week boundaries)
            if ($diffDays >= 6 && $diffDays <= 8) {
                // This Sunday is consecutive with the previous one
                $sundayStreak++;
            } else {
                // Gap is too large (or too small) - streak is broken
                // Stop counting backwards
                break;
            }
        }
    }
    
    // The effective streak is the calculated streak
    // Since the query includes the current check-in, if streak = 4, this is the 4th consecutive Sunday
    $effectiveStreak = $sundayStreak;
    
    // Log for debugging
    $debugStreakDates = array_map(function($d) {
        return $d->format('Y-m-d');
    }, array_slice($sundayDateObjects, 0, min(5, count($sundayDateObjects))));
    
    $remainingForMembership = max(0, 4 - $effectiveStreak);
    
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
    
    // Show membership form if:
    // 1. This is a Sunday service check-in (must be Sunday service to trigger)
    // 2. Guest is still active (not converted/archived)
    // 3. Guest has 4+ total Sunday attendances (including this check-in)
    // 4. Guest is not already a member
    $totalSundayCount = count($uniqueDates);
    
    // CRITICAL: Ensure current check-in is counted if it's a Sunday service
    // The query should include it, but double-check by adding 1 if needed
    if ($isSundayService && $totalSundayCount < 4) {
        // If this is a Sunday service and count is less than 4, the current check-in might not be counted
        // Add it manually to the count
        $totalSundayCount = max($totalSundayCount, count($sundayRows));
    }
    
    // SIMPLIFIED LOGIC: If this is a Sunday service AND guest has 4+ total Sunday attendances, show form
    // This ensures that on the 4th Sunday service check-in, the form appears immediately
    // Use the count of sundayRows (which includes current check-in) instead of uniqueDates
    $actualSundayCount = count($sundayRows); // This should include the current check-in
    
    $readyForMembership = false;
    
    // Check all conditions
    if ($isSundayService) {
        // Debug: Log the conditions
        error_log("Membership check - isSundayService: " . ($isSundayService ? 'true' : 'false'));
        error_log("Membership check - isGuestActive: " . ($isGuestActive ? 'true' : 'false'));
        error_log("Membership check - isAlreadyMember: " . ($isAlreadyMember ? 'true' : 'false'));
        error_log("Membership check - totalSundayCount: $totalSundayCount");
        error_log("Membership check - actualSundayCount: $actualSundayCount");
        error_log("Membership check - effectiveStreak: $effectiveStreak");
        
        if ($isGuestActive && !$isAlreadyMember) {
            // PRIMARY: Show form if guest has 4+ total Sunday attendances (including this one)
            // Use the larger of the two counts to be safe
            $finalCount = max($totalSundayCount, $actualSundayCount);
            
            // Show form if count is 4+ OR streak is 4+
            if ($finalCount >= 4 || $effectiveStreak >= 4) {
                $readyForMembership = true;
                error_log("Membership check - READY: finalCount=$finalCount, streak=$effectiveStreak");
            } else {
                error_log("Membership check - NOT READY: finalCount=$finalCount (need 4+), streak=$effectiveStreak (need 4+)");
            }
        } else {
            error_log("Membership check - NOT READY: isGuestActive=" . ($isGuestActive ? 'true' : 'false') . ", isAlreadyMember=" . ($isAlreadyMember ? 'true' : 'false'));
        }
    } else {
        error_log("Membership check - NOT READY (not Sunday service)");
    }

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
            'debug_info' => [
                'is_sunday_service' => $isSundayService,
                'is_guest_active' => $isGuestActive,
                'is_already_member' => $isAlreadyMember,
                'sunday_dates_count' => count($sundayDateObjects),
                'sunday_streak' => $sundayStreak,
                'effective_streak' => $effectiveStreak,
                'total_sunday_count' => $totalSundayCount,
                'guest_status' => $guestStatus,
                'recent_sunday_dates' => $debugStreakDates,
                'unique_sunday_count' => count($uniqueDates),
                'has_enough_sundays' => $totalSundayCount >= 4 || $effectiveStreak >= 4
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

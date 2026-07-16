<?php
date_default_timezone_set('Asia/Manila');

/**
 * Export a single event's attendance report (attendees + absentees).
 * Supports: pdf, xlsx
 * POST params: event_id, format
 */

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

require_once '../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(?string $dt): string {
    if (!$dt) return '—';
    try {
        $d = new DateTime($dt);
        $d->setTimezone(new DateTimeZone('Asia/Manila'));
        return $d->format('g:i A');
    } catch (Exception $e) { return $dt; }
}

function fmtDateTime(?string $dt): string {
    if (!$dt) return '—';
    try {
        $d = new DateTime($dt);
        $d->setTimezone(new DateTimeZone('Asia/Manila'));
        return $d->format('M d, Y g:i A');
    } catch (Exception $e) { return $dt; }
}

function fmtDate(?string $dt): string {
    if (!$dt) return '—';
    try {
        $d = new DateTime($dt);
        return $d->format('F d, Y');
    } catch (Exception $e) { return $dt; }
}

// ── fetch data ────────────────────────────────────────────────────────────────

try {
    // Support both POST (xlsx/pdf) and GET (json)
    if (isset($_GET['event_id'])) {
        $eventId = intval($_GET['event_id']);
        $format  = strtolower(trim($_GET['format'] ?? 'json'));
    } else {
        $eventId = isset($_POST['event_id']) ? intval($_POST['event_id']) : 0;
        $format  = strtolower(trim($_POST['format'] ?? 'pdf'));
    }

    if (!$eventId) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Event ID is required.']);
        exit();
    }

    $db = (new Database())->getConnection();
    // Church settings
    $churchSettings = null;
    try {
        $cs = $db->query("SELECT church_name, church_address, church_phone, church_email, church_logo FROM church_settings ORDER BY id LIMIT 1");
        if ($cs->rowCount() > 0) $churchSettings = $cs->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}

    // Event info
    $evStmt = $db->prepare("SELECT id, title, event_type, date, start_time, end_time, location, status FROM events WHERE id = :id");
    $evStmt->bindParam(':id', $eventId, PDO::PARAM_INT);
    $evStmt->execute();
    $event = $evStmt->fetch(PDO::FETCH_ASSOC);
    if (!$event) { http_response_code(404); echo 'Event not found.'; exit(); }

    // Attendees — Source 1: attendance table (member QR per-member scans via manager)
    $attStmt = $db->prepare("
        SELECT a.member_id, a.status AS att_status, a.check_in_time,
               m.first_name, m.middle_name, m.surname, m.suffix
        FROM attendance a
        LEFT JOIN members m ON a.member_id = m.id
        WHERE a.event_id = :eid
        ORDER BY a.check_in_time ASC
    ");
    $attStmt->bindParam(':eid', $eventId, PDO::PARAM_INT);
    $attStmt->execute();
    $attendeeRows = $attStmt->fetchAll(PDO::FETCH_ASSOC);
    $seenMemberIds = [];

    $attendees = [];
    foreach ($attendeeRows as $r) {
        $name = !empty($r['first_name'])
            ? trim($r['first_name']
                . (!empty($r['middle_name']) ? ' ' . substr($r['middle_name'],0,1) . '.' : '')
                . ' ' . $r['surname']
                . (!empty($r['suffix']) && strtolower($r['suffix']) !== 'none' ? ' ' . $r['suffix'] : ''))
            : 'Member';
        $attendees[] = ['name' => $name, 'time' => fmtDateTime($r['check_in_time'])];
        if ($r['member_id']) $seenMemberIds[(int)$r['member_id']] = true;
    }

    // Attendees — Source 2: legacy qr_attendance (backward compat)
    $attStmt2 = $db->prepare("
        SELECT qa.member_id, qa.member_name,
               MIN(qa.checkin_datetime) AS checkin_time,
               m.first_name, m.middle_name, m.surname, m.suffix
        FROM qr_attendance qa
        INNER JOIN qr_sessions qs ON qa.session_id = qs.id
        LEFT JOIN members m ON qa.member_id = m.id
        WHERE qs.event_id = :eid
        GROUP BY qa.member_id, qa.member_name, m.first_name, m.middle_name, m.surname, m.suffix
        ORDER BY checkin_time ASC
    ");
    $attStmt2->bindParam(':eid', $eventId, PDO::PARAM_INT);
    $attStmt2->execute();
    foreach ($attStmt2->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if ($r['member_id'] && isset($seenMemberIds[(int)$r['member_id']])) continue;
        $name = !empty($r['first_name'])
            ? trim($r['first_name']
                . (!empty($r['middle_name']) ? ' ' . substr($r['middle_name'],0,1) . '.' : '')
                . ' ' . $r['surname']
                . (!empty($r['suffix']) && strtolower($r['suffix']) !== 'none' ? ' ' . $r['suffix'] : ''))
            : ($r['member_name'] ?: 'Member');
        $attendees[] = ['name' => $name, 'time' => fmtDateTime($r['checkin_time'])];
        if ($r['member_id']) $seenMemberIds[(int)$r['member_id']] = true;
    }

    // Guest attendees
    $gStmt = $db->prepare("
        SELECT ga.checkin_time,
               COALESCE(g.full_name, CONCAT_WS(' ', g.first_name, g.surname)) AS name
        FROM guest_attendance ga
        LEFT JOIN guests g ON ga.guest_id = g.id
        LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
        WHERE ga.event_id = :eid OR (ga.event_id IS NULL AND qs.event_id = :eid2)
        ORDER BY ga.checkin_time ASC
    ");
    $gStmt->bindParam(':eid',  $eventId, PDO::PARAM_INT);
    $gStmt->bindParam(':eid2', $eventId, PDO::PARAM_INT);
    $gStmt->execute();
    foreach ($gStmt->fetchAll(PDO::FETCH_ASSOC) as $g) {
        $attendees[] = ['name' => trim($g['name'] ?: 'Guest'), 'time' => fmtDateTime($g['checkin_time'])];
    }

    // Absentees (active members who did NOT scan in either source)
    $absStmt = $db->prepare("
        SELECT m.first_name, m.middle_name, m.surname, m.suffix
        FROM members m
        WHERE m.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM attendance a
              WHERE a.event_id = :eid AND a.member_id = m.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM qr_attendance qa
              INNER JOIN qr_sessions qs ON qa.session_id = qs.id
              WHERE qs.event_id = :eid2 AND qa.member_id = m.id
          )
        ORDER BY m.surname ASC, m.first_name ASC
    ");
    $absStmt->bindParam(':eid',  $eventId, PDO::PARAM_INT);
    $absStmt->bindParam(':eid2', $eventId, PDO::PARAM_INT);
    $absStmt->execute();
    $absentees = array_map(function($r) {
        return trim($r['first_name']
            . (!empty($r['middle_name']) ? ' ' . substr($r['middle_name'],0,1) . '.' : '')
            . ' ' . $r['surname']
            . (!empty($r['suffix']) && strtolower($r['suffix']) !== 'none' ? ' ' . $r['suffix'] : ''));
    }, $absStmt->fetchAll(PDO::FETCH_ASSOC));

    $churchName  = $churchSettings['church_name'] ?? 'Church';
    $eventTitle  = $event['title'] ?? 'Event';
    $eventDate   = fmtDate($event['date']);
    $eventTime   = !empty($event['start_time']) ? date('g:i A', strtotime($event['start_time'])) : '';
    $eventLoc    = $event['location'] ?? '';
    $generatedAt = (new DateTime())->setTimezone(new DateTimeZone('Asia/Manila'))->format('F d, Y g:i A');

    // ── JSON (for client-side print) ─────────────────────────────────────────
    if ($format === 'json') {
        header('Content-Type: application/json');
        echo json_encode([
            'success'      => true,
            'event'        => [
                'title'    => $eventTitle,
                'date'     => $eventDate,
                'time'     => $eventTime,
                'location' => $eventLoc,
                'type'     => $event['event_type'] ?? '',
            ],
            'churchName'   => $churchName,
            'churchLogo'   => $churchSettings['church_logo'] ?? null,
            'attendees'    => $attendees,
            'absentees'    => array_values(array_map(fn($n) => ['name' => $n], $absentees)),
            'generatedAt'  => $generatedAt,
        ]);
        exit();
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    if ($format === 'pdf') {
        while (ob_get_level()) ob_end_clean();

        require_once __DIR__ . '/simple_pdf.php';
        $churchLogo = $churchSettings['church_logo'] ?? null;
        $pdf = new SimplePDF($churchLogo);

        // Header: logo left, church name right (inline)
        if ($churchLogo && strpos($churchLogo, 'data:image') === 0) {
            $pdf->addRaw("
                <table style='width:100%;border:none;margin-bottom:12px;'>
                  <tr>
                    <td style='width:80px;vertical-align:middle;border:none;'>
                      <img src='" . $churchLogo . "' style='max-width:70px;max-height:70px;display:block;' />
                    </td>
                    <td style='vertical-align:middle;border:none;padding-left:16px;'>
                      <div style='font-size:20px;font-weight:bold;color:#0f172a;'>" . htmlspecialchars($churchName) . "</div>
                      <div style='font-size:13px;color:#64748b;margin-top:4px;'>Event Attendance Report</div>
                    </td>
                  </tr>
                </table>
                <hr style='border:none;border-top:2px solid #e2e8f0;margin-bottom:12px;'>
            ");
        } else {
            $pdf->addTitle($churchName);
            $pdf->addSubtitle('Event Attendance Report');
        }
        $pdf->addText("Event: {$eventTitle}", 'center');
        $pdf->addText("Date: {$eventDate}" . ($eventTime ? "  |  Time: {$eventTime}" : '') . ($eventLoc ? "  |  Location: {$eventLoc}" : ''), 'center');

        $total = count($attendees) + count($absentees);
        $rate  = $total > 0 ? round((count($attendees) / $total) * 100) : 0;
        $pdf->addSummaryBox([
            'Present'         => count($attendees),
            'Absent'          => count($absentees),
            'Attendance Rate' => $rate . '%',
        ]);

        // Present table
        $pdf->addSubtitle('Present (' . count($attendees) . ')', 12);
        $attRows = [];
        foreach ($attendees as $i => $a) {
            $attRows[] = [$i + 1, $a['name'], $a['time']];
        }
        $pdf->addTable(['#', 'Name', 'Check-in Time'], $attRows ?: [['—', 'No attendees recorded', '']]);

        // Absent table
        $pdf->addSubtitle('Absent (' . count($absentees) . ')', 12);
        $absRows = [];
        foreach ($absentees as $i => $name) {
            $absRows[] = [$i + 1, $name];
        }
        $pdf->addTable(['#', 'Name'], $absRows ?: [['—', 'All active members attended']]);

        $pdf->output('Event_Report_' . preg_replace('/[^a-z0-9]/i', '_', $eventTitle) . '_' . date('Y-m-d') . '.pdf');
        exit();
    }

    // ── XLSX ─────────────────────────────────────────────────────────────────
    if ($format === 'xlsx') {
        while (ob_get_level()) ob_end_clean();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Event Report');

        // Fixed column widths: A=14(label/#), B=35(Name), C=22(Check-in Time)
        $sheet->getColumnDimension('A')->setWidth(14);
        $sheet->getColumnDimension('B')->setWidth(35);
        $sheet->getColumnDimension('C')->setWidth(22);

        $row = 1;

        // ── Logo beside church name ──
        $churchLogo = $churchSettings['church_logo'] ?? null;
        if ($churchLogo && strpos($churchLogo, 'data:image') === 0) {
            try {
                $logoData = explode(',', $churchLogo);
                if (count($logoData) === 2) {
                    $imageData = base64_decode($logoData[1]);
                    $mimeType = strpos($churchLogo, 'data:image/png') === 0 ? 'png' : 'jpg';
                    if ($imageData) {
                        $tempFile = tempnam(sys_get_temp_dir(), 'logo_') . '.' . $mimeType;
                        file_put_contents($tempFile, $imageData);
                        $drawing = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing();
                        $drawing->setName('Logo');
                        $drawing->setPath($tempFile);
                        $drawing->setCoordinates('A1');
                        $drawing->setHeight(50);
                        $drawing->setWorksheet($sheet);
                        register_shutdown_function(function() use ($tempFile) { if (file_exists($tempFile)) @unlink($tempFile); });
                        $sheet->getRowDimension(1)->setRowHeight(50);
                    }
                }
            } catch (Exception $e) { /* skip logo */ }
        }

        // Church name in B1:C1 beside the logo
        $sheet->mergeCells("B1:C1");
        $sheet->setCellValue("B1", strtoupper($churchName));
        $sheet->getStyle("B1")->getFont()->setBold(true)->setSize(15);
        $sheet->getStyle("B1")->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_LEFT)
            ->setVertical(Alignment::VERTICAL_CENTER);
        $row = 2;

        // ── Report title ──
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", 'Event Attendance Report');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row++;

        // ── Generated ──
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", 'Generated: ' . $generatedAt);
        $sheet->getStyle("A{$row}")->getFont()->setSize(9)->getColor()->setARGB('FF94A3B8');
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row += 2;

        // ── Event info block ──
        $infoStart = $row;
        $infoFields = [
            'Event'    => $eventTitle,
            'Date'     => $eventDate,
            'Time'     => $eventTime ?: '—',
            'Location' => $eventLoc  ?: '—',
        ];
        foreach ($infoFields as $label => $value) {
            $sheet->setCellValue("A{$row}", $label . ':');
            $sheet->mergeCells("B{$row}:C{$row}");
            $sheet->setCellValue("B{$row}", $value);
            $sheet->getStyle("A{$row}")->getFont()->setBold(true);
            $sheet->getStyle("A{$row}:C{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF8FAFC');
            $row++;
        }
        $row++;

        // ── Summary ──
        $total = count($attendees) + count($absentees);
        $rate  = $total > 0 ? round((count($attendees) / $total) * 100) : 0;
        $summaryData = [
            ['Present',         count($attendees), 'FF16A34A'],
            ['Absent',          count($absentees), 'FFDC2626'],
            ['Attendance Rate', $rate . '%',       'FF0049AF'],
        ];
        foreach ($summaryData as [$label, $value, $color]) {
            $sheet->setCellValue("A{$row}", $label . ':');
            $sheet->setCellValue("B{$row}", $value);
            $sheet->getStyle("A{$row}")->getFont()->setBold(true);
            $sheet->getStyle("B{$row}")->getFont()->setBold(true)->getColor()->setARGB('FF' . ltrim($color, 'FF'));
            $row++;
        }
        $row += 2;

        // ── Attendees section ──
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", 'PRESENT (' . count($attendees) . ')');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(11)->getColor()->setARGB('FFFFFFFF');
        $sheet->getStyle("A{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0049AF');
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($row)->setRowHeight(18);
        $row++;

        // Column headers
        foreach (['A' => '#', 'B' => 'Name', 'C' => 'Check-in Time'] as $col => $hdr) {
            $sheet->setCellValue("{$col}{$row}", $hdr);
        }
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true)->getColor()->setARGB('FF0F172A');
        $sheet->getStyle("A{$row}:C{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFDBEAFE');
        $sheet->getStyle("A{$row}:C{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row++;

        foreach ($attendees as $i => $a) {
            $bg = ($i % 2 === 0) ? 'FFFFFFFF' : 'FFF8FAFC';
            $sheet->setCellValue("A{$row}", $i + 1);
            $sheet->setCellValue("B{$row}", $a['name']);
            $sheet->setCellValue("C{$row}", $a['time']);
            $sheet->getStyle("A{$row}:C{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($bg);
            $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $row++;
        }
        if (empty($attendees)) {
            $sheet->mergeCells("A{$row}:C{$row}");
            $sheet->setCellValue("A{$row}", 'No attendees recorded');
            $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("A{$row}")->getFont()->getColor()->setARGB('FF94A3B8');
            $row++;
        }
        $row += 2;

        // ── Absentees section ──
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", 'ABSENT (' . count($absentees) . ')');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(11)->getColor()->setARGB('FFFFFFFF');
        $sheet->getStyle("A{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFDC2626');
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($row)->setRowHeight(18);
        $row++;

        foreach (['A' => '#', 'B' => 'Name'] as $col => $hdr) {
            $sheet->setCellValue("{$col}{$row}", $hdr);
        }
        $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true)->getColor()->setARGB('FF0F172A');
        $sheet->getStyle("A{$row}:B{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFEE2E2');
        $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row++;

        foreach ($absentees as $i => $name) {
            $bg = ($i % 2 === 0) ? 'FFFFFFFF' : 'FFFFF1F2';
            $sheet->setCellValue("A{$row}", $i + 1);
            $sheet->mergeCells("B{$row}:C{$row}");
            $sheet->setCellValue("B{$row}", $name);
            $sheet->getStyle("A{$row}:C{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($bg);
            $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $row++;
        }
        if (empty($absentees)) {
            $sheet->mergeCells("A{$row}:C{$row}");
            $sheet->setCellValue("A{$row}", 'All active members attended');
            $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("A{$row}")->getFont()->getColor()->setARGB('FF94A3B8');
        }

        $filename = 'Event_Report_' . preg_replace('/[^a-z0-9]/i', '_', $eventTitle) . '_' . date('Y-m-d') . '.xlsx';
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');
        (new Xlsx($spreadsheet))->save('php://output');
        exit();
    }

    http_response_code(400);
    echo 'Unsupported format.';

} catch (Throwable $e) {
    error_log('export_event: ' . $e->getMessage());
    http_response_code(500);
    echo 'Export failed: ' . $e->getMessage();
}
?>

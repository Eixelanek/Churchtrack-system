<?php
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
    $eventId = isset($_POST['event_id']) ? intval($_POST['event_id']) : 0;
    $format  = strtolower(trim($_POST['format'] ?? 'pdf'));

    if (!$eventId) {
        http_response_code(400);
        echo 'Event ID is required.';
        exit();
    }

    $db = (new Database())->getConnection();

    // Church settings
    $churchSettings = null;
    try {
        $cs = $db->query("SELECT church_name, church_address, church_phone, church_email FROM church_settings ORDER BY id LIMIT 1");
        if ($cs->rowCount() > 0) $churchSettings = $cs->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}

    // Event info
    $evStmt = $db->prepare("SELECT id, title, event_type, date, start_time, end_time, location, status FROM events WHERE id = :id");
    $evStmt->bindParam(':id', $eventId, PDO::PARAM_INT);
    $evStmt->execute();
    $event = $evStmt->fetch(PDO::FETCH_ASSOC);
    if (!$event) { http_response_code(404); echo 'Event not found.'; exit(); }

    // Attendees (members who scanned)
    $attStmt = $db->prepare("
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
    $attStmt->bindParam(':eid', $eventId, PDO::PARAM_INT);
    $attStmt->execute();
    $attendeeRows = $attStmt->fetchAll(PDO::FETCH_ASSOC);

    $attendees = array_map(function($r) {
        if (!empty($r['first_name'])) {
            $name = trim($r['first_name']
                . (!empty($r['middle_name']) ? ' ' . substr($r['middle_name'],0,1) . '.' : '')
                . ' ' . $r['surname']
                . (!empty($r['suffix']) && strtolower($r['suffix']) !== 'none' ? ' ' . $r['suffix'] : ''));
        } else {
            $name = $r['member_name'] ?: 'Guest';
        }
        return ['name' => $name, 'time' => fmtDateTime($r['checkin_time'])];
    }, $attendeeRows);

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

    // Absentees (active members who did NOT scan)
    $absStmt = $db->prepare("
        SELECT m.first_name, m.middle_name, m.surname, m.suffix
        FROM members m
        WHERE m.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM qr_attendance qa
              INNER JOIN qr_sessions qs ON qa.session_id = qs.id
              WHERE qs.event_id = :eid AND qa.member_id = m.id
          )
        ORDER BY m.surname ASC, m.first_name ASC
    ");
    $absStmt->bindParam(':eid', $eventId, PDO::PARAM_INT);
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

    // ── PDF ──────────────────────────────────────────────────────────────────
    if ($format === 'pdf') {
        while (ob_get_level()) ob_end_clean();

        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8', 'format' => 'A4',
            'margin_left' => 15, 'margin_right' => 15,
            'margin_top' => 15, 'margin_bottom' => 15,
        ]);

        $html = '<html><head><style>
            body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
            h1 { text-align:center; font-size:18px; margin:0 0 4px; }
            h2 { text-align:center; font-size:14px; margin:0 0 4px; color:#334155; }
            .meta { text-align:center; color:#64748b; font-size:10px; margin-bottom:16px; }
            .info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; margin-bottom:16px; }
            .info-row { display:flex; gap:24px; flex-wrap:wrap; }
            .info-item { flex:1; min-width:120px; }
            .info-label { font-size:9px; font-weight:bold; color:#64748b; text-transform:uppercase; letter-spacing:.05em; }
            .info-value { font-size:11px; color:#0f172a; margin-top:2px; }
            .section-title { font-size:12px; font-weight:bold; color:#0049af; margin:16px 0 6px; border-bottom:2px solid #0049af; padding-bottom:4px; }
            table { width:100%; border-collapse:collapse; margin-bottom:12px; }
            th { background:#0049af; color:#fff; padding:7px 8px; font-size:10px; text-align:left; }
            td { padding:6px 8px; border-bottom:1px solid #e2e8f0; font-size:10px; }
            tr:nth-child(even) td { background:#f8fafc; }
            .absent-table td { color:#475569; }
            .footer { text-align:center; font-size:9px; color:#94a3b8; margin-top:20px; }
            .summary-row { display:flex; gap:16px; margin-bottom:16px; }
            .summary-card { flex:1; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px; text-align:center; }
            .summary-num { font-size:22px; font-weight:bold; color:#0049af; }
            .summary-lbl { font-size:9px; color:#64748b; margin-top:2px; }
        </style></head><body>';

        $html .= '<h1>' . htmlspecialchars($churchName) . '</h1>';
        $html .= '<h2>Event Attendance Report</h2>';
        $html .= '<div class="meta">Generated: ' . $generatedAt . '</div>';

        $html .= '<div class="info-box"><div class="info-row">';
        $html .= '<div class="info-item"><div class="info-label">Event</div><div class="info-value">' . htmlspecialchars($eventTitle) . '</div></div>';
        $html .= '<div class="info-item"><div class="info-label">Date</div><div class="info-value">' . $eventDate . '</div></div>';
        if ($eventTime) $html .= '<div class="info-item"><div class="info-label">Time</div><div class="info-value">' . $eventTime . '</div></div>';
        if ($eventLoc)  $html .= '<div class="info-item"><div class="info-label">Location</div><div class="info-value">' . htmlspecialchars($eventLoc) . '</div></div>';
        $html .= '</div></div>';

        $html .= '<div class="summary-row">';
        $html .= '<div class="summary-card"><div class="summary-num">' . count($attendees) . '</div><div class="summary-lbl">Attended</div></div>';
        $html .= '<div class="summary-card"><div class="summary-num">' . count($absentees) . '</div><div class="summary-lbl">Absent</div></div>';
        $total = count($attendees) + count($absentees);
        $rate  = $total > 0 ? round((count($attendees) / $total) * 100) : 0;
        $html .= '<div class="summary-card"><div class="summary-num">' . $rate . '%</div><div class="summary-lbl">Attendance Rate</div></div>';
        $html .= '</div>';

        // Attendees table
        $html .= '<div class="section-title">✓ Attendees (' . count($attendees) . ')</div>';
        $html .= '<table><thead><tr><th>#</th><th>Name</th><th>Check-in Time</th></tr></thead><tbody>';
        foreach ($attendees as $i => $a) {
            $html .= '<tr><td>' . ($i+1) . '</td><td>' . htmlspecialchars($a['name']) . '</td><td>' . $a['time'] . '</td></tr>';
        }
        if (empty($attendees)) $html .= '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">No attendees recorded</td></tr>';
        $html .= '</tbody></table>';

        // Absentees table
        $html .= '<div class="section-title">✗ Absentees (' . count($absentees) . ')</div>';
        $html .= '<table class="absent-table"><thead><tr><th>#</th><th>Name</th></tr></thead><tbody>';
        foreach ($absentees as $i => $name) {
            $html .= '<tr><td>' . ($i+1) . '</td><td>' . htmlspecialchars($name) . '</td></tr>';
        }
        if (empty($absentees)) $html .= '<tr><td colspan="2" style="text-align:center;color:#94a3b8;">All active members attended</td></tr>';
        $html .= '</tbody></table>';

        $html .= '<div class="footer">' . htmlspecialchars($churchName) . ' — ChurchTrack</div>';
        $html .= '</body></html>';

        $mpdf->WriteHTML($html);
        $mpdf->Output('Event_Report_' . preg_replace('/[^a-z0-9]/i', '_', $eventTitle) . '_' . date('Y-m-d') . '.pdf', 'D');
        exit();
    }

    // ── XLSX ─────────────────────────────────────────────────────────────────
    if ($format === 'xlsx') {
        while (ob_get_level()) ob_end_clean();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Event Report');

        $row = 1;

        // Church name
        $sheet->mergeCells("A{$row}:D{$row}");
        $sheet->setCellValue("A{$row}", strtoupper($churchName));
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row++;

        $sheet->mergeCells("A{$row}:D{$row}");
        $sheet->setCellValue("A{$row}", 'Event Attendance Report');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(13);
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row++;

        $sheet->mergeCells("A{$row}:D{$row}");
        $sheet->setCellValue("A{$row}", 'Generated: ' . $generatedAt);
        $sheet->getStyle("A{$row}")->getFont()->setSize(9)->getColor()->setARGB('FF94A3B8');
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $row += 2;

        // Event info
        $sheet->setCellValue("A{$row}", 'Event:');   $sheet->setCellValue("B{$row}", $eventTitle);
        $sheet->getStyle("A{$row}")->getFont()->setBold(true);
        $row++;
        $sheet->setCellValue("A{$row}", 'Date:');    $sheet->setCellValue("B{$row}", $eventDate);
        $sheet->getStyle("A{$row}")->getFont()->setBold(true);
        $row++;
        if ($eventTime) {
            $sheet->setCellValue("A{$row}", 'Time:'); $sheet->setCellValue("B{$row}", $eventTime);
            $sheet->getStyle("A{$row}")->getFont()->setBold(true);
            $row++;
        }
        if ($eventLoc) {
            $sheet->setCellValue("A{$row}", 'Location:'); $sheet->setCellValue("B{$row}", $eventLoc);
            $sheet->getStyle("A{$row}")->getFont()->setBold(true);
            $row++;
        }
        $row++;

        // Summary
        $sheet->setCellValue("A{$row}", 'Attended:'); $sheet->setCellValue("B{$row}", count($attendees));
        $sheet->getStyle("A{$row}")->getFont()->setBold(true);
        $row++;
        $sheet->setCellValue("A{$row}", 'Absent:');   $sheet->setCellValue("B{$row}", count($absentees));
        $sheet->getStyle("A{$row}")->getFont()->setBold(true);
        $row += 2;

        // Attendees section
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->setCellValue("A{$row}", 'ATTENDEES (' . count($attendees) . ')');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(11)->getColor()->setARGB('FFFFFFFF');
        $sheet->getStyle("A{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0049AF');
        $row++;

        $sheet->setCellValue("A{$row}", '#');
        $sheet->setCellValue("B{$row}", 'Name');
        $sheet->setCellValue("C{$row}", 'Check-in Time');
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true);
        $sheet->getStyle("A{$row}:C{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFEFF6FF');
        $row++;

        foreach ($attendees as $i => $a) {
            $sheet->setCellValue("A{$row}", $i + 1);
            $sheet->setCellValue("B{$row}", $a['name']);
            $sheet->setCellValue("C{$row}", $a['time']);
            $row++;
        }
        $row += 2;

        // Absentees section
        $sheet->mergeCells("A{$row}:B{$row}");
        $sheet->setCellValue("A{$row}", 'ABSENTEES (' . count($absentees) . ')');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(11)->getColor()->setARGB('FFFFFFFF');
        $sheet->getStyle("A{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFDC2626');
        $row++;

        $sheet->setCellValue("A{$row}", '#');
        $sheet->setCellValue("B{$row}", 'Name');
        $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true);
        $sheet->getStyle("A{$row}:B{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFFF1F2');
        $row++;

        foreach ($absentees as $i => $name) {
            $sheet->setCellValue("A{$row}", $i + 1);
            $sheet->setCellValue("B{$row}", $name);
            $row++;
        }

        foreach (['A','B','C','D'] as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
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

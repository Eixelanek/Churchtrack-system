<?php
date_default_timezone_set('Asia/Manila');

// Add CORS headers for cross-origin requests

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors directly
ini_set('log_errors', 1);

// Set error handler to catch all errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

require_once '../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

function outputAttendanceXlsx(array $reportData, ?array $churchSettings = null): void
{
    if (ob_get_length()) {
        ob_end_clean();
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Attendance Report');

    $start = $reportData['dateRange']['start'] ?? '';
    $end = $reportData['dateRange']['end'] ?? '';

    $generatedAt = !empty($reportData['generatedAt'])
        ? new DateTime($reportData['generatedAt'])
        : new DateTime();
    $generatedAt->setTimezone(new DateTimeZone('Asia/Manila'));

    $currentRow = 1;

    // Add church header if church settings are provided
    if ($churchSettings) {
        $churchName = $churchSettings['church_name'] ?? 'Church';
        $churchLogo = $churchSettings['church_logo'] ?? null;
        
        // Add logo if available
        if ($churchLogo && strpos($churchLogo, 'data:image') === 0) {
            try {
                // Extract base64 data
                $logoData = explode(',', $churchLogo);
                if (count($logoData) === 2) {
                    $imageData = base64_decode($logoData[1]);
                    
                    // Determine image type
                    $mimeType = '';
                    if (strpos($churchLogo, 'data:image/png') === 0) {
                        $mimeType = 'png';
                    } elseif (strpos($churchLogo, 'data:image/jpeg') === 0 || strpos($churchLogo, 'data:image/jpg') === 0) {
                        $mimeType = 'jpg';
                    }
                    
                    if ($mimeType && $imageData) {
                        // Create temporary file for the logo
                        $tempFile = tempnam(sys_get_temp_dir(), 'church_logo_') . '.' . $mimeType;
                        file_put_contents($tempFile, $imageData);
                        
                        // Add logo to spreadsheet - right aligned in column C
                        $drawing = new Drawing();
                        $drawing->setName('Church Logo');
                        $drawing->setDescription('Church Logo');
                        $drawing->setPath($tempFile);
                        $drawing->setCoordinates('C1');
                        $drawing->setHeight(60); // Logo height
                        $drawing->setOffsetX(120); // Push to the right side of column C
                        $drawing->setWorksheet($sheet);
                        
                        // Clean up temp file after adding to spreadsheet
                        register_shutdown_function(function() use ($tempFile) {
                            if (file_exists($tempFile)) {
                                @unlink($tempFile);
                            }
                        });
                    }
                }
            } catch (Exception $e) {
                // If logo fails, continue without it
                error_log('Failed to add church logo to Excel: ' . $e->getMessage());
            }
        }
        
        // Set row height for logo
        $sheet->getRowDimension($currentRow)->setRowHeight(60);
        
        // Add church name - center aligned across all columns
        $sheet->mergeCells('A1:I1');
        $sheet->setCellValue('A1', strtoupper($churchName));
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(18);
        $sheet->getStyle('A1')->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER);
        
        $currentRow++;
        
        // Add church contact information (address, phone, email) - center aligned
        $contactInfo = [];
        if (!empty($churchSettings['church_address'])) {
            $contactInfo[] = $churchSettings['church_address'];
        }
        if (!empty($churchSettings['church_phone'])) {
            $contactInfo[] = 'Tel: ' . $churchSettings['church_phone'];
        }
        if (!empty($churchSettings['church_email'])) {
            $contactInfo[] = 'Email: ' . $churchSettings['church_email'];
        }
        
        if (!empty($contactInfo)) {
            foreach ($contactInfo as $info) {
                $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
                $sheet->setCellValue('A' . $currentRow, $info);
                $sheet->getStyle('A' . $currentRow)->getFont()->setSize(10);
                $sheet->getStyle('A' . $currentRow)->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $currentRow++;
            }
        }
        
        $currentRow++; // Add spacing after church header
    }

    // Add report title
    $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
    $sheet->setCellValue('A' . $currentRow, strtoupper($reportData['title'] ?? 'Attendance Report'));
    $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true)->setSize(14);
    $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $currentRow++;

    // Add period
    $sheet->setCellValue('A' . $currentRow, sprintf('Period: %s to %s', $start, $end));
    $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
    $currentRow++;
    
    // Add generated date
    $sheet->setCellValue('A' . $currentRow, 'Generated: ' . $generatedAt->format('M d, Y g:i A'));
    $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
    $currentRow++;

    // Add summary statistics
    $sheet->setCellValue('A' . $currentRow, 'Total Events: ' . ($reportData['totalEvents'] ?? 0));
    $sheet->setCellValue('C' . $currentRow, 'Total Attendance: ' . ($reportData['totalAttendance'] ?? 0));
    $sheet->setCellValue('F' . $currentRow, 'Average per Event: ' . ($reportData['averagePerEvent'] ?? 0));
    $currentRow += 2; // Add spacing before table

    $headerRow = $currentRow;
    $sheet->setCellValue('A' . $headerRow, 'Date');
    $sheet->setCellValue('B' . $headerRow, 'Time');
    $sheet->setCellValue('C' . $headerRow, 'Service');
    $sheet->setCellValue('D' . $headerRow, 'Total');
    $sheet->setCellValue('E' . $headerRow, 'Members');
    $sheet->setCellValue('F' . $headerRow, 'Guests');
    $sheet->setCellValue('G' . $headerRow, 'Member %');
    $sheet->setCellValue('H' . $headerRow, 'Guest %');
    $sheet->setCellValue('I' . $headerRow, 'Last Check-in');

    $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
    $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)->getFill()
        ->setFillType(Fill::FILL_SOLID)
        ->getStartColor()->setARGB('FF1D4ED8');

    $row = $headerRow + 1;
    foreach ($reportData['records'] as $record) {
        $sheet->setCellValue('A' . $row, formatExcelDateLabel($record['date'] ?? null));
        $sheet->setCellValue('B' . $row, formatExcelTimeLabel($record['time'] ?? null));
        $sheet->setCellValue('C' . $row, $record['title'] ?? '—');
        $sheet->setCellValue('D' . $row, $record['totalCheckins'] ?? 0);
        $sheet->setCellValue('E' . $row, $record['memberCheckins'] ?? 0);
        $sheet->setCellValue('F' . $row, $record['guestCheckins'] ?? 0);
        $sheet->setCellValue('G' . $row, formatExcelPercentLabel($record['memberCheckins'] ?? 0, $record['totalCheckins'] ?? 0));
        $sheet->setCellValue('H' . $row, formatExcelPercentLabel($record['guestCheckins'] ?? 0, $record['totalCheckins'] ?? 0));
        $sheet->setCellValue('I' . $row, formatExcelLastCheckinLabel($record));
        $row++;
    }

    $totalsRow = $row + 1;
    $sheet->setCellValue('C' . $totalsRow, 'Totals');
    $sheet->setCellValue('D' . $totalsRow, $reportData['totalAttendance'] ?? 0);
    $sheet->setCellValue('E' . $totalsRow, $reportData['totalMemberCheckins'] ?? 0);
    $sheet->setCellValue('F' . $totalsRow, $reportData['totalGuestCheckins'] ?? 0);
    $sheet->setCellValue('G' . $totalsRow, formatExcelPercentLabel($reportData['totalMemberCheckins'] ?? 0, $reportData['totalAttendance'] ?? 0));
    $sheet->setCellValue('H' . $totalsRow, formatExcelPercentLabel($reportData['totalGuestCheckins'] ?? 0, $reportData['totalAttendance'] ?? 0));

    $sheet->getStyle('C' . $totalsRow . ':H' . $totalsRow)->getFont()->setBold(true);

    $sheet->getStyle('D' . ($headerRow + 1) . ':H' . $totalsRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

    foreach (range('A', 'I') as $column) {
        $sheet->getColumnDimension($column)->setAutoSize(true);
    }

    $fileName = sprintf('attendance_report_%s_%s.xlsx', $start, $end);

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $fileName . '"');
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
}

function formatExcelDateLabel(?string $date): string
{
    if (empty($date)) {
        return '—';
    }

    try {
        $dt = new DateTime($date);
        return $dt->format('M d, Y');
    } catch (Exception $e) {
        return $date;
    }
}

function formatExcelTimeLabel(?string $time): string
{
    if (empty($time)) {
        return '—';
    }

    $dt = DateTime::createFromFormat('H:i', $time) ?: DateTime::createFromFormat('H:i:s', $time);
    if (!$dt) {
        return $time;
    }

    return $dt->format('g:i A');
}

function formatExcelPercentLabel($part, $total): string
{
    if (empty($total)) {
        return '—';
    }

    if (!is_numeric($part) || !is_numeric($total) || (float)$total === 0.0) {
        return '—';
    }

    $percentage = round(((float)$part / (float)$total) * 100);
    return $percentage . '%';
}

function formatExcelLastCheckinLabel(array $record): string
{
    $name = isset($record['lastCheckinName']) && $record['lastCheckinName'] !== '—'
        ? $record['lastCheckinName']
        : '';

    $timestampRaw = $record['lastCheckinAt'] ?? '';

    if (!empty($timestampRaw)) {
        $normalized = strpos($timestampRaw, 'T') !== false ? $timestampRaw : str_replace(' ', 'T', $timestampRaw);
        try {
            $dt = new DateTime($normalized);
            $dt->setTimezone(new DateTimeZone('Asia/Manila'));
            $timestampLabel = $dt->format('M d, Y g:i A');
        } catch (Exception $e) {
            $timestampLabel = $timestampRaw;
        }
    } else {
        $timestampLabel = '';
    }

    if ($name && $timestampLabel) {
        return $name . ' (' . $timestampLabel . ')';
    }

    if ($name) {
        return $name;
    }

    return $timestampLabel ?: '—';
}

function outputAttendanceCsv(array $reportData, ?array $churchSettings = null): void
{
    if (ob_get_length()) {
        ob_end_clean();
    }

    $filename = 'Attendance_Report_' . date('Y-m-d_His') . '.csv';
    
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    header('Pragma: public');

    $output = fopen('php://output', 'w');
    
    // Add BOM for Excel UTF-8 support
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    // Church header
    if ($churchSettings) {
        fputcsv($output, [$churchSettings['church_name'] ?? 'Church']);
    }
    fputcsv($output, ['Attendance Report']);
    
    $start = $reportData['dateRange']['start'] ?? '';
    $end = $reportData['dateRange']['end'] ?? '';
    fputcsv($output, ['Period: ' . $start . ' to ' . $end]);
    
    $generatedAt = !empty($reportData['generatedAt'])
        ? (new DateTime($reportData['generatedAt']))->setTimezone(new DateTimeZone('Asia/Manila'))->format('F d, Y g:i A')
        : (new DateTime())->setTimezone(new DateTimeZone('Asia/Manila'))->format('F d, Y g:i A');
    fputcsv($output, ['Generated: ' . $generatedAt]);
    
    // Summary
    fputcsv($output, []);
    fputcsv($output, ['Total Events', $reportData['totalEvents'] ?? 0]);
    fputcsv($output, ['Total Attendance', $reportData['totalAttendance'] ?? 0]);
    fputcsv($output, ['Member Check-ins', $reportData['totalMemberCheckins'] ?? 0]);
    fputcsv($output, ['Guest Check-ins', $reportData['totalGuestCheckins'] ?? 0]);
    fputcsv($output, ['Average per Event', $reportData['averagePerEvent'] ?? 0]);
    
    // Table header
    fputcsv($output, []);
    fputcsv($output, ['Date', 'Event', 'Type', 'Total', 'Members', 'Guests', 'Last Check-in']);
    
    // Data rows
    foreach ($reportData['records'] as $record) {
        $date = !empty($record['date']) ? (new DateTime($record['date']))->format('M d, Y') : '';
        $lastCheckin = formatExcelLastCheckinLabel($record);
        
        fputcsv($output, [
            $date,
            $record['title'] ?? '',
            $record['type'] ?? '',
            $record['totalCheckins'] ?? 0,
            $record['memberCheckins'] ?? 0,
            $record['guestCheckins'] ?? 0,
            $lastCheckin
        ]);
    }
    
    fclose($output);
    exit;
}

function outputAttendancePdfSimple(array $reportData, ?array $churchSettings = null): void
{
    require_once __DIR__ . '/simple_pdf.php';
    
    $churchLogo = $churchSettings['church_logo'] ?? null;
    $pdf = new SimplePDF($churchLogo);
    
    // Add logo if available
    if ($churchLogo) {
        $pdf->addLogo();
    }
    
    $churchName = $churchSettings['church_name'] ?? 'Church';
    $start = $reportData['dateRange']['start'] ?? '';
    $end = $reportData['dateRange']['end'] ?? '';
    
    $pdf->addTitle($churchName);
    $pdf->addSubtitle('Attendance Report');
    $pdf->addText("Period: {$start} to {$end}", 'center');
    
    $summary = [
        'Total Events' => $reportData['totalEvents'] ?? 0,
        'Total Attendance' => $reportData['totalAttendance'] ?? 0,
        'Member Check-ins' => $reportData['totalMemberCheckins'] ?? 0,
        'Guest Check-ins' => $reportData['totalGuestCheckins'] ?? 0,
        'Average per Event' => $reportData['averagePerEvent'] ?? 0
    ];
    $pdf->addSummaryBox($summary);
    
    $headers = ['Date', 'Event', 'Type', 'Total', 'Members', 'Guests', 'Last Check-in'];
    $rows = [];
    
    foreach ($reportData['records'] as $record) {
        $date = !empty($record['date']) ? (new DateTime($record['date']))->format('M d, Y') : '';
        $lastCheckin = formatExcelLastCheckinLabel($record);
        
        $rows[] = [
            $date,
            $record['title'] ?? '',
            $record['type'] ?? '',
            $record['totalCheckins'] ?? 0,
            $record['memberCheckins'] ?? 0,
            $record['guestCheckins'] ?? 0,
            $lastCheckin
        ];
    }
    
    $pdf->addTable($headers, $rows);
    $pdf->output('Attendance_Report_' . date('Y-m-d_His') . '.pdf');
}

function outputAttendancePdfMpdf(array $reportData, ?array $churchSettings = null): void
{
    while (ob_get_level()) {
        ob_end_clean();
    }

    require_once __DIR__ . '/../../vendor/autoload.php';
    
    $mpdf = new \Mpdf\Mpdf([
        'mode' => 'utf-8',
        'format' => 'A4',
        'margin_left' => 15,
        'margin_right' => 15,
        'margin_top' => 15,
        'margin_bottom' => 15
    ]);

    $churchName = $churchSettings['church_name'] ?? 'Church';
    $start = $reportData['dateRange']['start'] ?? '';
    $end = $reportData['dateRange']['end'] ?? '';
    
    $generatedAt = !empty($reportData['generatedAt'])
        ? (new DateTime($reportData['generatedAt']))->setTimezone(new DateTimeZone('Asia/Manila'))->format('F d, Y g:i A')
        : (new DateTime())->setTimezone(new DateTimeZone('Asia/Manila'))->format('F d, Y g:i A');

    // Build HTML
    $html = '<html><head><style>
        body { font-family: Arial, sans-serif; }
        h1 { text-align: center; color: #333; margin-bottom: 5px; }
        h2 { text-align: center; color: #666; font-size: 18px; margin-top: 0; }
        .period { text-align: center; color: #888; margin-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .summary-item { display: inline-block; margin-right: 30px; }
        .summary-label { font-weight: bold; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #4F46E5; color: white; padding: 10px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .numeric { text-align: center; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #888; }
    </style></head><body>';
    
    $html .= '<h1>' . htmlspecialchars($churchName) . '</h1>';
    $html .= '<h2>Attendance Report</h2>';
    $html .= '<div class="period">Period: ' . htmlspecialchars($start) . ' to ' . htmlspecialchars($end) . '</div>';
    
    $html .= '<div class="summary">';
    $html .= '<div class="summary-item"><span class="summary-label">Total Events:</span> ' . ($reportData['totalEvents'] ?? 0) . '</div>';
    $html .= '<div class="summary-item"><span class="summary-label">Total Attendance:</span> ' . ($reportData['totalAttendance'] ?? 0) . '</div>';
    $html .= '<div class="summary-item"><span class="summary-label">Member Check-ins:</span> ' . ($reportData['totalMemberCheckins'] ?? 0) . '</div>';
    $html .= '<div class="summary-item"><span class="summary-label">Guest Check-ins:</span> ' . ($reportData['totalGuestCheckins'] ?? 0) . '</div>';
    $html .= '<div class="summary-item"><span class="summary-label">Average per Event:</span> ' . ($reportData['averagePerEvent'] ?? 0) . '</div>';
    $html .= '</div>';
    
    $html .= '<table>';
    $html .= '<thead><tr>';
    $html .= '<th>Date</th><th>Event</th><th>Type</th><th class="numeric">Total</th><th class="numeric">Members</th><th class="numeric">Guests</th><th>Last Check-in</th>';
    $html .= '</tr></thead><tbody>';
    
    foreach ($reportData['records'] as $record) {
        $date = !empty($record['date']) ? (new DateTime($record['date']))->format('M d, Y') : '';
        $lastCheckin = formatExcelLastCheckinLabel($record);
        
        $html .= '<tr>';
        $html .= '<td>' . htmlspecialchars($date) . '</td>';
        $html .= '<td>' . htmlspecialchars($record['title'] ?? '') . '</td>';
        $html .= '<td>' . htmlspecialchars($record['type'] ?? '') . '</td>';
        $html .= '<td class="numeric">' . ($record['totalCheckins'] ?? 0) . '</td>';
        $html .= '<td class="numeric">' . ($record['memberCheckins'] ?? 0) . '</td>';
        $html .= '<td class="numeric">' . ($record['guestCheckins'] ?? 0) . '</td>';
        $html .= '<td>' . htmlspecialchars($lastCheckin) . '</td>';
        $html .= '</tr>';
    }
    
    $html .= '</tbody></table>';
    $html .= '<div class="footer">Generated: ' . $generatedAt . '</div>';
    $html .= '</body></html>';

    $mpdf->WriteHTML($html);
    
    $filename = 'Attendance_Report_' . date('Y-m-d_His') . '.pdf';
    $mpdf->Output($filename, 'D');
    exit;
}

function outputAttendancePdf(array $reportData, ?array $churchSettings = null): void
{
    // Clean all output buffers
    while (ob_get_level()) {
        ob_end_clean();
    }

    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
    
    // Set document information
    $pdf->SetCreator('ChurchTrack');
    $pdf->SetAuthor($churchSettings['church_name'] ?? 'Church');
    $pdf->SetTitle('Attendance Report');
    
    // Remove default header/footer
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    
    // Set margins
    $pdf->SetMargins(15, 15, 15);
    $pdf->SetAutoPageBreak(TRUE, 15);
    
    // Add a page
    $pdf->AddPage();
    
    // Church Header
    if ($churchSettings) {
        $churchName = $churchSettings['church_name'] ?? 'Church';
        $churchLogo = $churchSettings['church_logo'] ?? null;
        
        // Logo feature not available in PDF export
        // Use XLSX export if you need the logo in the report
        
        // Church Name
        $pdf->SetFont('helvetica', 'B', 16);
        $pdf->Cell(0, 8, strtoupper($churchName), 0, 1, 'C');
        
        // Contact Info
        $pdf->SetFont('helvetica', '', 9);
        if (!empty($churchSettings['church_address'])) {
            $pdf->Cell(0, 5, $churchSettings['church_address'], 0, 1, 'C');
        }
        $contactLine = [];
        if (!empty($churchSettings['church_phone'])) {
            $contactLine[] = $churchSettings['church_phone'];
        }
        if (!empty($churchSettings['church_email'])) {
            $contactLine[] = $churchSettings['church_email'];
        }
        if (!empty($contactLine)) {
            $pdf->Cell(0, 5, implode(' | ', $contactLine), 0, 1, 'C');
        }
        $pdf->Ln(5);
    }
    
    // Report Title
    $pdf->SetFont('helvetica', 'B', 14);
    $pdf->Cell(0, 8, 'ATTENDANCE REPORT', 0, 1, 'C');
    $pdf->Ln(2);
    
    // Report Info
    $pdf->SetFont('helvetica', '', 10);
    $startDate = $reportData['dateRange']['start'] ?? '';
    $endDate = $reportData['dateRange']['end'] ?? '';
    $pdf->Cell(0, 6, sprintf('Period: %s to %s', $startDate, $endDate), 0, 1, 'C');
    
    $generatedAt = !empty($reportData['generatedAt']) ? new DateTime($reportData['generatedAt']) : new DateTime();
    $generatedAt->setTimezone(new DateTimeZone('Asia/Manila'));
    $pdf->Cell(0, 6, 'Generated: ' . $generatedAt->format('M d, Y g:i A'), 0, 1, 'C');
    $pdf->Ln(3);
    
    // Summary Stats
    $pdf->SetFont('helvetica', 'B', 10);
    $summaryText = sprintf(
        'Total Events: %d  |  Total Attendance: %d  |  Average per Event: %s',
        $reportData['totalEvents'] ?? 0,
        $reportData['totalAttendance'] ?? 0,
        $reportData['averagePerEvent'] ?? 0
    );
    $pdf->Cell(0, 6, $summaryText, 0, 1, 'C');
    $pdf->Ln(5);
    
    // Table Header
    $pdf->SetFillColor(29, 78, 216);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->SetFont('helvetica', 'B', 9);
    
    $pdf->Cell(24, 9, 'Date', 1, 0, 'C', true);
    $pdf->Cell(18, 9, 'Time', 1, 0, 'C', true);
    $pdf->Cell(48, 9, 'Service', 1, 0, 'C', true);
    $pdf->Cell(16, 9, 'Total', 1, 0, 'C', true);
    $pdf->Cell(22, 9, 'Members', 1, 0, 'C', true);
    $pdf->Cell(18, 9, 'Guests', 1, 0, 'C', true);
    $pdf->Cell(18, 9, 'Mem %', 1, 0, 'C', true);
    $pdf->Cell(18, 9, 'Guest %', 1, 1, 'C', true);
    
    // Table Body
    $pdf->SetTextColor(0, 0, 0);
    $pdf->SetFont('helvetica', '', 8);
    
    foreach ($reportData['records'] as $record) {
        $pdf->Cell(24, 7, formatExcelDateLabel($record['date'] ?? null), 1, 0, 'L');
        $pdf->Cell(18, 7, formatExcelTimeLabel($record['time'] ?? null), 1, 0, 'C');
        $pdf->Cell(48, 7, substr($record['title'] ?? '—', 0, 28), 1, 0, 'L');
        $pdf->Cell(16, 7, $record['totalCheckins'] ?? 0, 1, 0, 'C');
        $pdf->Cell(22, 7, $record['memberCheckins'] ?? 0, 1, 0, 'C');
        $pdf->Cell(18, 7, $record['guestCheckins'] ?? 0, 1, 0, 'C');
        $pdf->Cell(18, 7, formatExcelPercentLabel($record['memberCheckins'] ?? 0, $record['totalCheckins'] ?? 0), 1, 0, 'C');
        $pdf->Cell(18, 7, formatExcelPercentLabel($record['guestCheckins'] ?? 0, $record['totalCheckins'] ?? 0), 1, 1, 'C');
    }
    
    // Totals Row
    $pdf->SetFont('helvetica', 'B', 9);
    $pdf->Cell(90, 8, 'Totals', 1, 0, 'R');
    $pdf->Cell(16, 8, $reportData['totalAttendance'] ?? 0, 1, 0, 'C');
    $pdf->Cell(22, 8, $reportData['totalMemberCheckins'] ?? 0, 1, 0, 'C');
    $pdf->Cell(18, 8, $reportData['totalGuestCheckins'] ?? 0, 1, 0, 'C');
    $pdf->Cell(18, 8, formatExcelPercentLabel($reportData['totalMemberCheckins'] ?? 0, $reportData['totalAttendance'] ?? 0), 1, 0, 'C');
    $pdf->Cell(18, 8, formatExcelPercentLabel($reportData['totalGuestCheckins'] ?? 0, $reportData['totalAttendance'] ?? 0), 1, 1, 'C');
    
    $fileName = sprintf('attendance_report_%s_%s.pdf', $startDate, $endDate);
    
    // Output PDF
    $pdf->Output($fileName, 'D');
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get church settings
    $churchSettings = null;
    try {
        $settingsQuery = "SELECT church_name, church_address, church_phone, church_email, church_logo FROM church_settings ORDER BY id LIMIT 1";
        $settingsStmt = $db->prepare($settingsQuery);
        $settingsStmt->execute();
        if ($settingsStmt->rowCount() > 0) {
            $churchSettings = $settingsStmt->fetch(PDO::FETCH_ASSOC);
        }
    } catch (Exception $e) {
        // Continue without church settings if query fails
        error_log('Failed to fetch church settings: ' . $e->getMessage());
    }
    
    // Get parameters from either JSON or form POST
    $format = 'json';
    $startDate = date('Y-m-01');
    $endDate = date('Y-m-t');
    
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    
    if ($contentType === 'application/json' || strpos($contentType, 'application/json') !== false) {
        // JSON request
        $data = json_decode(file_get_contents("php://input"));
        $format = isset($data->format) ? strtolower($data->format) : 'json';
        $startDate = isset($data->startDate) ? $data->startDate : $startDate;
        $endDate = isset($data->endDate) ? $data->endDate : $endDate;
    } else {
        // Form POST request
        $format = isset($_POST['format']) ? strtolower($_POST['format']) : 'json';
        $startDate = isset($_POST['startDate']) ? $_POST['startDate'] : $startDate;
        $endDate = isset($_POST['endDate']) ? $_POST['endDate'] : $endDate;
    }
    
    // ── Source 1: Events from the attendance table (per-member QR scans via manager) ──
    // Group by event, aggregate member check-ins
    $eventQuery = "
        SELECT
            e.id                                          AS event_id,
            COALESCE(NULLIF(e.title,''), 'Unnamed Event') AS service_name,
            e.event_type,
            'event'                                       AS session_type,
            CONCAT(e.date, ' ', COALESCE(e.start_time, '00:00:00')) AS event_datetime,
            COUNT(CASE WHEN a.status IN ('present','late') THEN 1 END) AS total_checkins,
            COUNT(CASE WHEN a.status IN ('present','late') THEN 1 END) AS member_checkins,
            0                                             AS guest_checkins,
            MIN(CASE WHEN a.status IN ('present','late') THEN a.check_in_time END) AS first_checkin,
            MAX(CASE WHEN a.status IN ('present','late') THEN a.check_in_time END) AS last_checkin_at
        FROM events e
        INNER JOIN attendance a ON a.event_id = e.id
        WHERE DATE(e.date) BETWEEN :start_date AND :end_date
          AND a.status IN ('present','late')
        GROUP BY e.id, e.title, e.event_type, e.date, e.start_time
        ORDER BY e.date DESC, e.start_time DESC
    ";
    $evtStmt = $db->prepare($eventQuery);
    $evtStmt->bindParam(':start_date', $startDate);
    $evtStmt->bindParam(':end_date',   $endDate);
    $evtStmt->execute();
    $eventRows = $evtStmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Source 2: QR sessions (legacy, only those linked to existing events or standalone) ──
    // Exclude sessions whose event has been deleted (allow NULL event_id for standalone sessions)
    $query = "SELECT 
                qs.id,
                COALESCE(NULLIF(qs.service_name, ''), 'Unnamed Service') AS service_name,
                qs.event_type,
                qs.session_type,
                qs.event_datetime,
                COUNT(qa.id) AS total_checkins,
                SUM(CASE WHEN qa.member_id IS NOT NULL THEN 1 ELSE 0 END) AS member_checkins,
                SUM(CASE WHEN qa.member_id IS NULL THEN 1 ELSE 0 END) AS guest_checkins,
                MAX(qa.checkin_datetime) AS last_checkin_at,
                (
                    SELECT 
                        CASE 
                            WHEN qa2.member_id IS NOT NULL THEN CONCAT(m2.first_name, ' ', m2.surname)
                            WHEN qa2.member_name IS NOT NULL AND TRIM(qa2.member_name) <> '' THEN qa2.member_name
                            ELSE '—'
                        END
                    FROM qr_attendance qa2
                    LEFT JOIN members m2 ON qa2.member_id = m2.id
                    WHERE qa2.session_id = qs.id
                    ORDER BY qa2.checkin_datetime DESC
                    LIMIT 1
                ) AS last_checkin_name
              FROM qr_sessions qs
              LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
              LEFT JOIN members m ON qa.member_id = m.id
              WHERE DATE(qs.event_datetime) BETWEEN :start_date2 AND :end_date2
                AND (
                    qs.event_id IS NULL
                    OR EXISTS (SELECT 1 FROM events e WHERE e.id = qs.event_id)
                )
              GROUP BY qs.id
              ORDER BY qs.event_datetime DESC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date2', $startDate);
    $stmt->bindParam(':end_date2',   $endDate);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Format Source 1 (attendance table / event-based) ──────────────────
    $formattedRecords = [];
    foreach ($eventRows as $r) {
        $datetime = !empty($r['event_datetime']) ? new DateTime($r['event_datetime']) : null;
        $formattedRecords[] = [
            'eventId'          => 'evt-' . (int)$r['event_id'],
            'title'            => $r['service_name'],
            'type'             => $r['event_type'] ?? '',
            'sessionType'      => $r['session_type'],
            'date'             => $datetime ? $datetime->format('Y-m-d') : null,
            'time'             => $datetime ? $datetime->format('H:i')   : null,
            'location'         => '',
            'totalCheckins'    => (int)$r['total_checkins'],
            'memberCheckins'   => (int)$r['member_checkins'],
            'guestCheckins'    => (int)$r['guest_checkins'],
            'uniqueMemberCount'=> (int)$r['member_checkins'],
            'uniqueGuestCount' => 0,
            'memberNames'      => [],
            'guestNames'       => [],
            'attendeeNames'    => [],
            'attendeeNameCount'=> 0,
            'guestNameCount'   => 0,
            'lastCheckinAt'    => $r['last_checkin_at'] ?? null,
            'lastCheckinName'  => '—',
        ];
    }

    // Track event IDs already covered by Source 1 so we don't double-count
    $coveredEventIds = array_map(fn($r) => (int)$r['event_id'], $eventRows);

    // ── Format Source 2 (qr_sessions / legacy) ────────────────────────────
    // Skip qr_sessions that belong to an event already counted in Source 1
    foreach ($records as $record) {
        $datetime = !empty($record['event_datetime']) ? new DateTime($record['event_datetime']) : null;
        $formattedRecords[] = [
            'eventId'          => (int)$record['id'],
            'title'            => $record['service_name'],
            'type'             => $record['event_type'],
            'sessionType'      => $record['session_type'],
            'date'             => $datetime ? $datetime->format('Y-m-d') : null,
            'time'             => $datetime ? $datetime->format('H:i')   : null,
            'location'         => 'QR Session',
            'totalCheckins'    => (int)$record['total_checkins'],
            'memberCheckins'   => (int)$record['member_checkins'],
            'guestCheckins'    => (int)$record['guest_checkins'],
            'uniqueMemberCount'=> 0,
            'uniqueGuestCount' => 0,
            'memberNames'      => [],
            'guestNames'       => [],
            'attendeeNames'    => [],
            'attendeeNameCount'=> 0,
            'guestNameCount'   => 0,
            'lastCheckinAt'    => $record['last_checkin_at'] ?? null,
            'lastCheckinName'  => $record['last_checkin_name'] ?? '—',
        ];
    }

    $totalAttendance = array_sum(array_column($formattedRecords, 'totalCheckins'));
    $totalMemberCheckins = array_sum(array_column($formattedRecords, 'memberCheckins'));
    $totalGuestCheckins = array_sum(array_column($formattedRecords, 'guestCheckins'));

    $uniqueMembersLookup = [];
    $uniqueGuestsLookup = [];

    foreach ($formattedRecords as $record) {
        foreach ($record['memberNames'] as $name) {
            $normalized = mb_strtolower(trim($name));
            if ($normalized !== '') {
                $uniqueMembersLookup[$normalized] = $name;
            }
        }

        foreach ($record['guestNames'] as $name) {
            $normalized = mb_strtolower(trim($name));
            if ($normalized !== '') {
                $uniqueGuestsLookup[$normalized] = $name;
            }
        }
    }

    $reportData = [
        'title' => 'Attendance Report',
        'dateRange' => [
            'start' => $startDate,
            'end' => $endDate
        ],
        'generatedAt' => date('c'),
        'totalEvents' => count($records),
        'totalAttendance' => $totalAttendance,
        'totalMemberCheckins' => $totalMemberCheckins,
        'totalGuestCheckins' => $totalGuestCheckins,
        'uniqueMembers' => count($uniqueMembersLookup),
        'uniqueGuests' => count($uniqueGuestsLookup),
        'averagePerEvent' => count($records) > 0 ? round($totalAttendance / count($records), 2) : 0,
        'records' => $formattedRecords
    ];
    
    if (in_array($format, ['xlsx', 'excel'], true)) {
        outputAttendanceXlsx($reportData, $churchSettings);
        exit();
    }
    
    if ($format === 'csv') {
        outputAttendanceCsv($reportData, $churchSettings);
        exit();
    }
    
    if ($format === 'pdf') {
        // Use simple PDF generator that doesn't require external libraries
        outputAttendancePdfSimple($reportData, $churchSettings);
        exit();
    }

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'data' => $reportData
    ]);
    
} catch (Exception $e) {
    // Catch all exceptions including PDOException
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

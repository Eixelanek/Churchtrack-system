<?php
// Add CORS headers for cross-origin requests

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Enable error reporting for debugging
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
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

function outputMembershipXlsx(array $members, ?array $churchSettings = null): void
{
    if (ob_get_length()) {
        ob_end_clean();
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Membership Report');

    $generatedAt = new DateTime();
    $generatedAt->setTimezone(new DateTimeZone('Asia/Manila'));

    $currentRow = 1;

    // Add church header if church settings are provided
    if ($churchSettings) {
        $churchName = $churchSettings['church_name'] ?? 'Church';
        $churchLogo = $churchSettings['church_logo'] ?? null;
        
        // Add logo if available
        if ($churchLogo && strpos($churchLogo, 'data:image') === 0) {
            try {
                $logoData = explode(',', $churchLogo);
                if (count($logoData) === 2) {
                    $imageData = base64_decode($logoData[1]);
                    
                    $mimeType = '';
                    if (strpos($churchLogo, 'data:image/png') === 0) {
                        $mimeType = 'png';
                    } elseif (strpos($churchLogo, 'data:image/jpeg') === 0 || strpos($churchLogo, 'data:image/jpg') === 0) {
                        $mimeType = 'jpg';
                    }
                    
                    if ($mimeType && $imageData) {
                        $tempFile = tempnam(sys_get_temp_dir(), 'church_logo_') . '.' . $mimeType;
                        file_put_contents($tempFile, $imageData);
                        
                        $drawing = new Drawing();
                        $drawing->setName('Church Logo');
                        $drawing->setDescription('Church Logo');
                        $drawing->setPath($tempFile);
                        $drawing->setCoordinates('A1');
                        $drawing->setHeight(60);
                        $drawing->setWorksheet($sheet);
                        
                        register_shutdown_function(function() use ($tempFile) {
                            if (file_exists($tempFile)) {
                                @unlink($tempFile);
                            }
                        });
                    }
                }
            } catch (Exception $e) {
                error_log('Failed to add church logo to Excel: ' . $e->getMessage());
            }
        }
        
        $sheet->getRowDimension($currentRow)->setRowHeight(60);
        $sheet->mergeCells("B{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("B{$currentRow}", $churchName);
        $sheet->getStyle("B{$currentRow}")->getFont()->setBold(true)->setSize(18);
        $sheet->getStyle("B{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $currentRow++;
        
        $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", "Membership Report");
        $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $currentRow++;
    } else {
        $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", "Membership Report");
        $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $currentRow++;
    }

    // Generated date
    $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
    $sheet->setCellValue("A{$currentRow}", "Generated: " . $generatedAt->format('F d, Y g:i A'));
    $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $currentRow++;
    
    // Summary statistics
    $totalMembers = count($members);
    $activeMembers = count(array_filter($members, fn($m) => strtolower($m['status']) === 'active'));
    $inactiveMembers = count(array_filter($members, fn($m) => strtolower($m['status']) === 'inactive'));
    
    $currentRow++;
    $sheet->setCellValue("A{$currentRow}", "Total Members:");
    $sheet->setCellValue("B{$currentRow}", $totalMembers);
    $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
    $currentRow++;
    
    $sheet->setCellValue("A{$currentRow}", "Active Members:");
    $sheet->setCellValue("B{$currentRow}", $activeMembers);
    $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
    $sheet->getStyle("A{$currentRow}")->getFont()->getColor()->setRGB('22C55E');
    $currentRow++;
    
    $sheet->setCellValue("A{$currentRow}", "Inactive Members:");
    $sheet->setCellValue("B{$currentRow}", $inactiveMembers);
    $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
    $sheet->getStyle("A{$currentRow}")->getFont()->getColor()->setRGB('F59E0B');
    $currentRow++;
    
    $currentRow++;

    // Table headers
    $headers = ['#', 'Name', 'Email', 'Contact', 'Birthday', 'Gender', 'Status', 'Joined Date'];
    $col = 'A';
    foreach ($headers as $header) {
        $sheet->setCellValue("{$col}{$currentRow}", $header);
        $col++;
    }
    
    // Style headers
    $headerRange = "A{$currentRow}:H{$currentRow}";
    $sheet->getStyle($headerRange)->getFont()->setBold(true);
    $sheet->getStyle($headerRange)->getFill()
        ->setFillType(Fill::FILL_SOLID)
        ->getStartColor()->setRGB('4F46E5');
    $sheet->getStyle($headerRange)->getFont()->getColor()->setRGB('FFFFFF');
    $sheet->getStyle($headerRange)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle($headerRange)->getBorders()->getAllBorders()
        ->setBorderStyle(Border::BORDER_THIN);
    
    $currentRow++;
    $dataStartRow = $currentRow;

    // Add member data
    $rowNum = 1;
    foreach ($members as $member) {
        $sheet->setCellValue("A{$currentRow}", $rowNum);
        $sheet->setCellValue("B{$currentRow}", $member['name'] ?? '');
        $sheet->setCellValue("C{$currentRow}", $member['email'] ?? '');
        $sheet->setCellValue("D{$currentRow}", $member['contact_number'] ?? '');
        
        // Format birthday
        $birthday = '';
        if (!empty($member['birthday'])) {
            try {
                $bday = new DateTime($member['birthday']);
                $birthday = $bday->format('M d, Y');
            } catch (Exception $e) {
                $birthday = $member['birthday'];
            }
        }
        $sheet->setCellValue("E{$currentRow}", $birthday);
        
        $sheet->setCellValue("F{$currentRow}", $member['gender'] ?? '');
        $sheet->setCellValue("G{$currentRow}", ucfirst($member['status'] ?? ''));
        
        // Format joined date
        $joinedDate = '';
        if (!empty($member['created_at'])) {
            try {
                $joined = new DateTime($member['created_at']);
                $joinedDate = $joined->format('M d, Y');
            } catch (Exception $e) {
                $joinedDate = $member['created_at'];
            }
        }
        $sheet->setCellValue("H{$currentRow}", $joinedDate);
        
        // Color code status
        $status = strtolower($member['status'] ?? '');
        if ($status === 'active') {
            $sheet->getStyle("G{$currentRow}")->getFont()->getColor()->setRGB('22C55E');
        } elseif ($status === 'inactive') {
            $sheet->getStyle("G{$currentRow}")->getFont()->getColor()->setRGB('F59E0B');
        }
        
        $currentRow++;
        $rowNum++;
    }

    $dataEndRow = $currentRow - 1;

    // Add borders to data
    if ($dataEndRow >= $dataStartRow) {
        $dataRange = "A{$dataStartRow}:H{$dataEndRow}";
        $sheet->getStyle($dataRange)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN)
            ->getColor()->setRGB('CCCCCC');
    }

    // Auto-size columns
    foreach (range('A', 'H') as $col) {
        $sheet->getColumnDimension($col)->setAutoSize(true);
    }

    // Output file
    $filename = 'Membership_Report_' . date('Y-m-d_His') . '.xlsx';
    
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    header('Pragma: public');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
    exit;
}

function outputMembershipCsv(array $members, ?array $churchSettings = null): void
{
    if (ob_get_length()) {
        ob_end_clean();
    }

    $filename = 'Membership_Report_' . date('Y-m-d_His') . '.csv';
    
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
    fputcsv($output, ['Membership Report']);
    
    $generatedAt = (new DateTime())->setTimezone(new DateTimeZone('Asia/Manila'))->format('F d, Y g:i A');
    fputcsv($output, ['Generated: ' . $generatedAt]);
    
    // Summary
    $totalMembers = count($members);
    $activeMembers = count(array_filter($members, fn($m) => strtolower($m['status']) === 'active'));
    $inactiveMembers = count(array_filter($members, fn($m) => strtolower($m['status']) === 'inactive'));
    
    fputcsv($output, []);
    fputcsv($output, ['Total Members', $totalMembers]);
    fputcsv($output, ['Active Members', $activeMembers]);
    fputcsv($output, ['Inactive Members', $inactiveMembers]);
    
    // Table header
    fputcsv($output, []);
    fputcsv($output, ['#', 'Name', 'Email', 'Contact', 'Birthday', 'Gender', 'Status', 'Joined Date']);
    
    // Data rows
    $rowNum = 1;
    foreach ($members as $member) {
        $birthday = '';
        if (!empty($member['birthday'])) {
            try {
                $bday = new DateTime($member['birthday']);
                $birthday = $bday->format('M d, Y');
            } catch (Exception $e) {
                $birthday = $member['birthday'];
            }
        }
        
        $joinedDate = '';
        if (!empty($member['created_at'])) {
            try {
                $joined = new DateTime($member['created_at']);
                $joinedDate = $joined->format('M d, Y');
            } catch (Exception $e) {
                $joinedDate = $member['created_at'];
            }
        }
        
        fputcsv($output, [
            $rowNum,
            $member['name'] ?? '',
            $member['email'] ?? '',
            $member['contact_number'] ?? '',
            $birthday,
            $member['gender'] ?? '',
            ucfirst($member['status'] ?? ''),
            $joinedDate
        ]);
        
        $rowNum++;
    }
    
    fclose($output);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();

    // Get filter parameters
    $status = isset($_GET['status']) ? $_GET['status'] : 'all'; // 'all', 'active', 'inactive'
    $includeInactive = isset($_GET['include_inactive']) ? $_GET['include_inactive'] === 'true' : true;

    // Build query based on filters
    $whereConditions = [];
    if ($status === 'active') {
        $whereConditions[] = "m.status = 'active'";
    } elseif ($status === 'inactive') {
        $whereConditions[] = "m.status = 'inactive'";
    } else {
        // All members (active and inactive)
        $whereConditions[] = "m.status IN ('active', 'inactive')";
    }

    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // Fetch members
    $query = "SELECT 
                m.id,
                CONCAT(m.first_name, ' ', 
                       COALESCE(CONCAT(m.middle_name, ' '), ''), 
                       m.surname,
                       CASE WHEN m.suffix != 'None' THEN CONCAT(' ', m.suffix) ELSE '' END) as name,
                m.email,
                m.contact_number,
                m.birthday,
                m.gender,
                m.status,
                m.created_at
              FROM members m
              {$whereClause}
              ORDER BY m.created_at DESC";

    $stmt = $db->prepare($query);
    $stmt->execute();
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get church settings
    $churchSettings = null;
    try {
        $settingsQuery = "SELECT church_name, church_logo FROM church_settings LIMIT 1";
        $settingsStmt = $db->prepare($settingsQuery);
        $settingsStmt->execute();
        $churchSettings = $settingsStmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        // Church settings table might not exist
    }

    // Get format parameter
    $format = isset($_GET['format']) ? strtolower($_GET['format']) : 'xlsx';

    // Generate report in requested format
    if ($format === 'csv') {
        outputMembershipCsv($members, $churchSettings);
    } elseif ($format === 'pdf') {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'PDF export is currently unavailable. Please use Excel or CSV format instead.',
            'error' => 'PDF generation not yet implemented for membership reports'
        ]);
    } else {
        // Default to Excel
        outputMembershipXlsx($members, $churchSettings);
    }

} catch (Exception $e) {
    error_log('Membership export error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Failed to generate membership report: ' . $e->getMessage()
    ]);
}

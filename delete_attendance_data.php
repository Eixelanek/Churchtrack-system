<?php
// Delete all attendance data from Aiven database

require_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    echo "Deleting all attendance data...\n\n";
    
    // Delete from attendance table
    $deleteAttendance = "DELETE FROM attendance";
    $stmt = $db->prepare($deleteAttendance);
    $stmt->execute();
    $attendanceCount = $stmt->rowCount();
    echo "✓ Deleted $attendanceCount records from attendance table\n";
    
    // Delete from qr_attendance table if it exists
    try {
        $deleteQrAttendance = "DELETE FROM qr_attendance";
        $stmt = $db->prepare($deleteQrAttendance);
        $stmt->execute();
        $qrAttendanceCount = $stmt->rowCount();
        echo "✓ Deleted $qrAttendanceCount records from qr_attendance table\n";
    } catch (PDOException $e) {
        echo "Note: qr_attendance table might not exist or is empty\n";
    }
    
    echo "\n✓ All attendance data has been deleted successfully!\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>

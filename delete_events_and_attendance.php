<?php
// Delete all events, QR sessions, and attendance data from Aiven database

require_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    echo "Deleting all events, QR sessions, and attendance data...\n\n";
    
    // Disable foreign key checks temporarily
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Delete from attendance table
    $deleteAttendance = "DELETE FROM attendance";
    $stmt = $db->prepare($deleteAttendance);
    $stmt->execute();
    $attendanceCount = $stmt->rowCount();
    echo "✓ Deleted $attendanceCount records from attendance table\n";
    
    // Delete from qr_attendance table
    try {
        $deleteQrAttendance = "DELETE FROM qr_attendance";
        $stmt = $db->prepare($deleteQrAttendance);
        $stmt->execute();
        $qrAttendanceCount = $stmt->rowCount();
        echo "✓ Deleted $qrAttendanceCount records from qr_attendance table\n";
    } catch (PDOException $e) {
        echo "Note: qr_attendance table might not exist\n";
    }
    
    // Delete from qr_sessions table
    $deleteQrSessions = "DELETE FROM qr_sessions";
    $stmt = $db->prepare($deleteQrSessions);
    $stmt->execute();
    $qrSessionsCount = $stmt->rowCount();
    echo "✓ Deleted $qrSessionsCount records from qr_sessions table\n";
    
    // Delete from event_links table (if exists)
    try {
        $deleteEventLinks = "DELETE FROM event_links";
        $stmt = $db->prepare($deleteEventLinks);
        $stmt->execute();
        $eventLinksCount = $stmt->rowCount();
        echo "✓ Deleted $eventLinksCount records from event_links table\n";
    } catch (PDOException $e) {
        echo "Note: event_links table might not exist\n";
    }
    
    // Delete from events table
    $deleteEvents = "DELETE FROM events";
    $stmt = $db->prepare($deleteEvents);
    $stmt->execute();
    $eventsCount = $stmt->rowCount();
    echo "✓ Deleted $eventsCount records from events table\n";
    
    // Re-enable foreign key checks
    $db->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    echo "\n✓ All events, QR sessions, and attendance data have been deleted successfully!\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    // Re-enable foreign key checks even on error
    try {
        $db->exec("SET FOREIGN_KEY_CHECKS = 1");
    } catch (Exception $e2) {}
    exit(1);
}
?>

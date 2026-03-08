<?php
/**
 * Auto-complete events that have passed 2 hours from their start time
 * This should be run every 15 minutes via cron job
 */

header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Find events that should be auto-completed
    // Event is auto-completed if: current time >= event start time + 2 hours
    $query = "SELECT id, title, date, start_time 
              FROM events 
              WHERE status != 'completed' 
              AND TIMESTAMPADD(HOUR, 2, CONCAT(date, ' ', start_time)) <= NOW()";
    
    $stmt = $db->prepare($query);
    $stmt->execute();

    $completed_events = [];
    
    while ($event = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $event_id = $event['id'];
        
        // Start transaction for each event
        $db->beginTransaction();
        
        try {
            // Mark event as completed with auto_ended flag
            $update_query = "UPDATE events 
                           SET status = 'completed', 
                               auto_ended = 1, 
                               manually_ended = 0,
                               updated_at = NOW()
                           WHERE id = :id";
            
            $update_stmt = $db->prepare($update_query);
            $update_stmt->bindParam(":id", $event_id);
            $update_stmt->execute();
            
            // Mark all active members who didn't attend as absent
            $mark_absent_query = "INSERT INTO attendance (event_id, member_id, status, check_in_time) 
                                 SELECT :event_id, m.id, 'absent', NOW()
                                 FROM members m 
                                 WHERE m.status = 'active' 
                                 AND m.created_at <= NOW()
                                 AND m.id NOT IN (
                                     SELECT a.member_id 
                                     FROM attendance a 
                                     WHERE a.event_id = :event_id
                                 )";
            
            $mark_absent_stmt = $db->prepare($mark_absent_query);
            $mark_absent_stmt->bindParam(":event_id", $event_id);
            $mark_absent_stmt->execute();
            
            // Commit transaction
            $db->commit();
            
            $completed_events[] = [
                'id' => $event_id,
                'title' => $event['title'],
                'date' => $event['date'],
                'start_time' => $event['start_time']
            ];
            
        } catch (Exception $e) {
            $db->rollback();
            error_log("Failed to auto-complete event {$event_id}: " . $e->getMessage());
        }
    }

    http_response_code(200);
    echo json_encode([
        "message" => "Auto-completion check completed",
        "completed_count" => count($completed_events),
        "completed_events" => $completed_events,
        "timestamp" => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "message" => "Server error: " . $e->getMessage(),
        "timestamp" => date('Y-m-d H:i:s')
    ]);
}
?>

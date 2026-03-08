<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Start transaction
    $db->beginTransaction();

    try {
        // Find events that are completed but have NULL values for auto_ended and manually_ended
        $fix_query = "UPDATE events 
                      SET auto_ended = 0, manually_ended = 1 
                      WHERE status = 'completed' 
                      AND (auto_ended IS NULL OR manually_ended IS NULL)";
        
        $fix_stmt = $db->prepare($fix_query);
        $fix_stmt->execute();
        
        $fixed_count = $fix_stmt->rowCount();
        
        // Also fix events that might be showing as active/upcoming but should be completed
        // based on their end time OR if the date is in the past
        $auto_complete_query = "UPDATE events 
                               SET status = 'completed', auto_ended = 1, manually_ended = 0 
                               WHERE status IN ('active', 'upcoming') 
                               AND (CONCAT(date, ' ', end_time) < NOW() OR date < CURDATE())";
        
        $auto_complete_stmt = $db->prepare($auto_complete_query);
        $auto_complete_stmt->execute();
        
        $auto_completed_count = $auto_complete_stmt->rowCount();
        
        // Commit transaction
        $db->commit();
        
        http_response_code(200);
        echo json_encode([
            "message" => "Event status fixed successfully.",
            "fixed_events" => $fixed_count,
            "auto_completed_events" => $auto_completed_count
        ]);
        
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?>

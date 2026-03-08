<?php
/**
 * Test file to manually trigger auto-completion
 * Access via: https://churchtrack-api.onrender.com/api/cron/test_auto_complete.php
 */

echo "<h2>Testing Auto-Complete Events</h2>";
echo "<p>Current server time: " . date('Y-m-d H:i:s') . "</p>";

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Show events that will be auto-completed
    $check_query = "SELECT id, title, date, start_time, status,
                    CONCAT(date, ' ', start_time) as event_datetime,
                    DATE_SUB(NOW(), INTERVAL -2 HOUR) as cutoff_time
                    FROM events 
                    WHERE status != 'completed'
                    ORDER BY date DESC, start_time DESC";
    
    $stmt = $db->prepare($check_query);
    $stmt->execute();

    echo "<h3>Events Status:</h3>";
    echo "<table border='1' cellpadding='5'>";
    echo "<tr><th>ID</th><th>Title</th><th>Date</th><th>Start Time</th><th>Status</th><th>Should Complete?</th></tr>";
    
    while ($event = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $event_datetime = strtotime($event['date'] . ' ' . $event['start_time']);
        $cutoff_time = strtotime('-2 hours');
        $should_complete = $event_datetime <= $cutoff_time ? 'YES' : 'NO';
        $color = $should_complete === 'YES' ? 'red' : 'green';
        
        echo "<tr>";
        echo "<td>{$event['id']}</td>";
        echo "<td>{$event['title']}</td>";
        echo "<td>{$event['date']}</td>";
        echo "<td>{$event['start_time']}</td>";
        echo "<td>{$event['status']}</td>";
        echo "<td style='color: {$color}; font-weight: bold;'>{$should_complete}</td>";
        echo "</tr>";
    }
    echo "</table>";

    echo "<br><br>";
    echo "<form method='post'>";
    echo "<button type='submit' name='run_auto_complete'>Run Auto-Complete Now</button>";
    echo "</form>";

    if (isset($_POST['run_auto_complete'])) {
        echo "<h3>Running Auto-Complete...</h3>";
        
        // Include and run the auto-complete script
        ob_start();
        include 'auto_complete_events.php';
        $result = ob_get_clean();
        
        echo "<pre>" . htmlspecialchars($result) . "</pre>";
    }

} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
}
?>

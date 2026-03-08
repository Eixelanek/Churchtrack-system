<?php
echo "=== SYNCING LOCAL SCHEMA TO AIVEN ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    echo "Reading local schema file...\n";
    $sql = file_get_contents('local_complete_schema.sql');
    
    // Split by semicolons but keep CREATE TABLE statements together
    $statements = [];
    $current = '';
    $lines = explode("\n", $sql);
    
    foreach ($lines as $line) {
        $line = trim($line);
        
        // Skip comments and empty lines
        if (empty($line) || strpos($line, '--') === 0 || strpos($line, '/*') === 0) {
            continue;
        }
        
        $current .= $line . "\n";
        
        // If line ends with semicolon and we're not inside a CREATE TABLE
        if (substr($line, -1) === ';') {
            $statements[] = trim($current);
            $current = '';
        }
    }
    
    echo "Found " . count($statements) . " SQL statements\n\n";
    
    $success = 0;
    $errors = 0;
    
    foreach ($statements as $statement) {
        if (empty(trim($statement))) continue;
        
        try {
            // Extract table name for display
            if (preg_match('/CREATE TABLE.*?`?(\w+)`?/i', $statement, $matches)) {
                $tableName = $matches[1];
                echo "Processing table: $tableName\n";
                
                // Drop table first to recreate with correct schema
                try {
                    $conn->exec("DROP TABLE IF EXISTS `$tableName`");
                } catch (PDOException $e) {
                    // Ignore foreign key errors
                }
                
                $conn->exec($statement);
                echo "  ✓ Created\n";
                $success++;
            } else {
                $conn->exec($statement);
                $success++;
            }
        } catch (PDOException $e) {
            echo "  ✗ Error: " . $e->getMessage() . "\n";
            $errors++;
        }
    }
    
    echo "\n=== SYNC COMPLETE ===\n";
    echo "Success: $success\n";
    echo "Errors: $errors\n";
    
} catch (Exception $e) {
    echo "Fatal error: " . $e->getMessage() . "\n";
}
?>

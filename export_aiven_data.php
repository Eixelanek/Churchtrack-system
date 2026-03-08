<?php
// Export data from Aiven to SQL file for InfinityFree import

$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$db = "defaultdb";
$user = "avnadmin";
$pass = "AVNS_YXyhc87L5iDG6SRQ4cg";

echo "Connecting to Aiven...\n";
$conn = new PDO("mysql:host=$host;port=$port;dbname=$db", $user, $pass);
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
echo "✓ Connected\n\n";

$outputFile = "infinityfree_import.sql";
$fp = fopen($outputFile, 'w');

// Write header
fwrite($fp, "-- ChurchTrack Database Export for InfinityFree\n");
fwrite($fp, "-- Generated: " . date('Y-m-d H:i:s') . "\n\n");
fwrite($fp, "SET FOREIGN_KEY_CHECKS = 0;\n");
fwrite($fp, "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n");

// Get all tables
$tables = $conn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

foreach ($tables as $table) {
    echo "Exporting: $table\n";
    
    // Get CREATE TABLE statement
    $createStmt = $conn->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
    $createTableSql = $createStmt['Create Table'];
    
    // Remove any problematic constraints or symbols
    $createTableSql = preg_replace('/CONSTRAINT `[^`]+`/', '', $createTableSql);
    
    fwrite($fp, "-- Table: $table\n");
    fwrite($fp, "DROP TABLE IF EXISTS `$table`;\n");
    fwrite($fp, $createTableSql . ";\n\n");
    
    // Get data
    $rows = $conn->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
    
    if (!empty($rows)) {
        $columns = array_keys($rows[0]);
        $columnList = '`' . implode('`, `', $columns) . '`';
        
        fwrite($fp, "INSERT INTO `$table` ($columnList) VALUES\n");
        
        $values = [];
        foreach ($rows as $row) {
            $vals = [];
            foreach ($row as $val) {
                if ($val === null) {
                    $vals[] = 'NULL';
                } else {
                    // Properly escape for MySQL
                    $escaped = str_replace(
                        ["\\", "\0", "\n", "\r", "'", '"', "\x1a"],
                        ["\\\\", "\\0", "\\n", "\\r", "\\'", '\\"', "\\Z"],
                        $val
                    );
                    $vals[] = "'" . $escaped . "'";
                }
            }
            $values[] = '(' . implode(', ', $vals) . ')';
        }
        
        fwrite($fp, implode(",\n", $values) . ";\n\n");
        echo "  ✓ Exported " . count($rows) . " rows\n";
    } else {
        echo "  ✓ Table is empty\n";
    }
}

fwrite($fp, "SET FOREIGN_KEY_CHECKS = 1;\n");
fclose($fp);

echo "\n✓ Export complete!\n";
echo "File saved: $outputFile\n";
echo "\nNext steps:\n";
echo "1. Go to InfinityFree control panel\n";
echo "2. Click 'phpMyAdmin' for database: if0_41276444_ChurchTrack\n";
echo "3. Click 'Import' tab\n";
echo "4. Upload: $outputFile\n";
?>

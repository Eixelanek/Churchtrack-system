<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Check if church_settings table exists, if not create it
    $checkTable = $db->query("SHOW TABLES LIKE 'church_settings'");
    if ($checkTable->rowCount() === 0) {
        // Create church_settings table
        $createTable = "CREATE TABLE IF NOT EXISTS church_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            church_name VARCHAR(255) NOT NULL DEFAULT 'Christ-Like Christian Church',
            church_logo LONGTEXT,
            header_logo LONGTEXT,
            help_center_email VARCHAR(255) NULL,
            help_center_phone VARCHAR(50) NULL,
            help_center_url VARCHAR(255) NULL,
            date_format VARCHAR(20) NOT NULL DEFAULT 'mm/dd/yyyy',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        $db->exec($createTable);
        
        // Insert default row
        $insertDefault = "INSERT INTO church_settings (church_name, church_logo, header_logo, help_center_email, help_center_phone, help_center_url, date_format) 
                         VALUES ('Christ-Like Christian Church', NULL, NULL, NULL, NULL, NULL, 'mm/dd/yyyy')";
        $db->exec($insertDefault);
    }
    
    // Ensure header_logo column exists (for older installs)
    $checkHeaderCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'header_logo'");
    if ($checkHeaderCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN header_logo LONGTEXT NULL AFTER church_logo");
    }
    
    $checkHelpEmailCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'help_center_email'");
    if ($checkHelpEmailCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN help_center_email VARCHAR(255) NULL AFTER header_logo");
    }
    
    $checkHelpPhoneCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'help_center_phone'");
    if ($checkHelpPhoneCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN help_center_phone VARCHAR(50) NULL AFTER help_center_email");
    }
    
    $checkHelpUrlCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'help_center_url'");
    if ($checkHelpUrlCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN help_center_url VARCHAR(255) NULL AFTER help_center_phone");
    }
    
    // Ensure church contact fields exist
    $checkAddressCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'church_address'");
    if ($checkAddressCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN church_address TEXT NULL AFTER church_name");
    }
    
    $checkPhoneCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'church_phone'");
    if ($checkPhoneCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN church_phone VARCHAR(50) NULL AFTER church_address");
    }
    
    $checkEmailCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'church_email'");
    if ($checkEmailCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN church_email VARCHAR(255) NULL AFTER church_phone");
    }
    
    // Ensure homepage_image columns exist
    for ($i = 1; $i <= 6; $i++) {
        $checkHomepageCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'homepage_image_$i'");
        if ($checkHomepageCol->rowCount() === 0) {
            $afterCol = $i === 1 ? 'date_format' : "homepage_image_" . ($i - 1);
            $db->exec("ALTER TABLE church_settings ADD COLUMN homepage_image_$i LONGTEXT NULL AFTER $afterCol");
        }
    }

    // Ensure homepage hero text columns exist
    $checkHeroTitleCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'homepage_hero_title'");
    if ($checkHeroTitleCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN homepage_hero_title VARCHAR(255) NULL AFTER homepage_image_6");
    }

    $checkHeroSubtitleCol = $db->query("SHOW COLUMNS FROM church_settings LIKE 'homepage_hero_subtitle'");
    if ($checkHeroSubtitleCol->rowCount() === 0) {
        $db->exec("ALTER TABLE church_settings ADD COLUMN homepage_hero_subtitle VARCHAR(255) NULL AFTER homepage_hero_title");
    }
    
    // Get church settings
    $query = "SELECT church_name, church_address, church_phone, church_email, church_logo, header_logo, help_center_email, help_center_phone, help_center_url, date_format, homepage_image_1, homepage_image_2, homepage_image_3, homepage_image_4, homepage_image_5, homepage_image_6, homepage_hero_title, homepage_hero_subtitle FROM church_settings ORDER BY id LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            "success" => true,
            "data" => [
                "churchName" => $settings['church_name'],
                "churchAddress" => $settings['church_address'],
                "churchPhone" => $settings['church_phone'],
                "churchEmail" => $settings['church_email'],
                "churchLogo" => $settings['church_logo'],
                "headerLogo" => $settings['header_logo'],
                "helpCenterEmail" => $settings['help_center_email'],
                "helpCenterPhone" => $settings['help_center_phone'],
                "helpCenterUrl" => $settings['help_center_url'],
                "dateFormat" => $settings['date_format'],
                "homepage_image_1" => $settings['homepage_image_1'],
                "homepage_image_2" => $settings['homepage_image_2'],
                "homepage_image_3" => $settings['homepage_image_3'],
                "homepage_image_4" => $settings['homepage_image_4'],
                "homepage_image_5" => $settings['homepage_image_5'],
                "homepage_image_6" => $settings['homepage_image_6'],
                "homepage_hero_title" => $settings['homepage_hero_title'],
                "homepage_hero_subtitle" => $settings['homepage_hero_subtitle']
            ]
        ]);
    } else {
        // No settings found, return defaults
        echo json_encode([
            "success" => true,
            "data" => [
                "churchName" => 'Christ-Like Christian Church',
                "churchAddress" => null,
                "churchPhone" => null,
                "churchEmail" => null,
                "churchLogo" => null,
                "headerLogo" => null,
                "helpCenterEmail" => null,
                "helpCenterPhone" => null,
                "helpCenterUrl" => null,
                "dateFormat" => 'mm/dd/yyyy',
                "homepage_image_1" => null,
                "homepage_image_2" => null,
                "homepage_image_3" => null,
                "homepage_image_4" => null,
                "homepage_image_5" => null,
                "homepage_image_6" => null,
                "homepage_hero_title" => "SHAPING FUTURES\nWITH FAITH",
                "homepage_hero_subtitle" => "Join us for an uplifting experience"
            ]
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>


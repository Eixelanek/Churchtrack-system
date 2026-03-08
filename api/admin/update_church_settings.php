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
    
    // Get posted data
    $data = json_decode(file_get_contents("php://input"));
    $churchName = $data->churchName ?? null;
    $churchAddress = property_exists($data, 'churchAddress') ? $data->churchAddress : null;
    $churchPhone = property_exists($data, 'churchPhone') ? $data->churchPhone : null;
    $churchEmail = property_exists($data, 'churchEmail') ? $data->churchEmail : null;
    $churchLogo = property_exists($data, 'churchLogo') ? $data->churchLogo : null;
    $headerLogo = property_exists($data, 'headerLogo') ? $data->headerLogo : null;
    $dateFormat = property_exists($data, 'dateFormat') ? $data->dateFormat : 'mm/dd/yyyy';
    $helpCenterEmail = property_exists($data, 'helpCenterEmail') ? $data->helpCenterEmail : null;
    $helpCenterPhone = property_exists($data, 'helpCenterPhone') ? $data->helpCenterPhone : null;
    $helpCenterUrl = property_exists($data, 'helpCenterUrl') ? $data->helpCenterUrl : null;
    $homepageImage1 = property_exists($data, 'homepage_image_1') ? $data->homepage_image_1 : null;
    $homepageImage2 = property_exists($data, 'homepage_image_2') ? $data->homepage_image_2 : null;
    $homepageImage3 = property_exists($data, 'homepage_image_3') ? $data->homepage_image_3 : null;
    $homepageImage4 = property_exists($data, 'homepage_image_4') ? $data->homepage_image_4 : null;
    $homepageImage5 = property_exists($data, 'homepage_image_5') ? $data->homepage_image_5 : null;
    $homepageImage6 = property_exists($data, 'homepage_image_6') ? $data->homepage_image_6 : null;
    $homepageHeroTitle = property_exists($data, 'homepage_hero_title') ? $data->homepage_hero_title : null;
    $homepageHeroSubtitle = property_exists($data, 'homepage_hero_subtitle') ? $data->homepage_hero_subtitle : null;
    
    if (!empty($churchName)) {
        // Check if settings exist
        $checkQuery = "SELECT id FROM church_settings LIMIT 1";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() > 0) {
            // Get the first ID
            $firstRow = $checkStmt->fetch(PDO::FETCH_ASSOC);
            $settingsId = $firstRow['id'];
            
            // Update existing settings
            $query = "UPDATE church_settings SET 
                     church_name = :church_name,
                     church_address = :church_address,
                     church_phone = :church_phone,
                     church_email = :church_email,
                     church_logo = :church_logo,
                     header_logo = :header_logo,
                     help_center_email = :help_center_email,
                     help_center_phone = :help_center_phone,
                     help_center_url = :help_center_url,
                     date_format = :date_format,
                     homepage_image_1 = :homepage_image_1,
                     homepage_image_2 = :homepage_image_2,
                     homepage_image_3 = :homepage_image_3,
                     homepage_image_4 = :homepage_image_4,
                     homepage_image_5 = :homepage_image_5,
                     homepage_image_6 = :homepage_image_6,
                     homepage_hero_title = :homepage_hero_title,
                     homepage_hero_subtitle = :homepage_hero_subtitle,
                     updated_at = NOW()
                     WHERE id = :settings_id";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(":church_name", $churchName);
            $stmt->bindParam(":church_address", $churchAddress);
            $stmt->bindParam(":church_phone", $churchPhone);
            $stmt->bindParam(":church_email", $churchEmail);
            $stmt->bindParam(":church_logo", $churchLogo);
            $stmt->bindParam(":header_logo", $headerLogo);
            $stmt->bindParam(":help_center_email", $helpCenterEmail);
            $stmt->bindParam(":help_center_phone", $helpCenterPhone);
            $stmt->bindParam(":help_center_url", $helpCenterUrl);
            $stmt->bindParam(":date_format", $dateFormat);
            $stmt->bindParam(":homepage_image_1", $homepageImage1);
            $stmt->bindParam(":homepage_image_2", $homepageImage2);
            $stmt->bindParam(":homepage_image_3", $homepageImage3);
            $stmt->bindParam(":homepage_image_4", $homepageImage4);
            $stmt->bindParam(":homepage_image_5", $homepageImage5);
            $stmt->bindParam(":homepage_image_6", $homepageImage6);
            $stmt->bindParam(":homepage_hero_title", $homepageHeroTitle);
            $stmt->bindParam(":homepage_hero_subtitle", $homepageHeroSubtitle);
            $stmt->bindParam(":settings_id", $settingsId);
            
            if ($stmt->execute()) {
                http_response_code(200);
                echo json_encode([
                    "success" => true,
                    "message" => "Church settings updated successfully."
                ]);
            } else {
                http_response_code(503);
                echo json_encode([
                    "success" => false,
                    "message" => "Unable to update church settings."
                ]);
            }
        } else {
            // Insert new settings
            $query = "INSERT INTO church_settings (church_name, church_address, church_phone, church_email, church_logo, header_logo, help_center_email, help_center_phone, help_center_url, date_format, homepage_image_1, homepage_image_2, homepage_image_3, homepage_image_4, homepage_image_5, homepage_image_6, homepage_hero_title, homepage_hero_subtitle) 
                     VALUES (:church_name, :church_address, :church_phone, :church_email, :church_logo, :header_logo, :help_center_email, :help_center_phone, :help_center_url, :date_format, :homepage_image_1, :homepage_image_2, :homepage_image_3, :homepage_image_4, :homepage_image_5, :homepage_image_6, :homepage_hero_title, :homepage_hero_subtitle)";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(":church_name", $churchName);
            $stmt->bindParam(":church_address", $churchAddress);
            $stmt->bindParam(":church_phone", $churchPhone);
            $stmt->bindParam(":church_email", $churchEmail);
            $stmt->bindParam(":church_logo", $churchLogo);
            $stmt->bindParam(":header_logo", $headerLogo);
            $stmt->bindParam(":help_center_email", $helpCenterEmail);
            $stmt->bindParam(":help_center_phone", $helpCenterPhone);
            $stmt->bindParam(":help_center_url", $helpCenterUrl);
            $stmt->bindParam(":date_format", $dateFormat);
            $stmt->bindParam(":homepage_image_1", $homepageImage1);
            $stmt->bindParam(":homepage_image_2", $homepageImage2);
            $stmt->bindParam(":homepage_image_3", $homepageImage3);
            $stmt->bindParam(":homepage_image_4", $homepageImage4);
            $stmt->bindParam(":homepage_image_5", $homepageImage5);
            $stmt->bindParam(":homepage_image_6", $homepageImage6);
            $stmt->bindParam(":homepage_hero_title", $homepageHeroTitle);
            $stmt->bindParam(":homepage_hero_subtitle", $homepageHeroSubtitle);
            
            if ($stmt->execute()) {
                http_response_code(200);
                echo json_encode([
                    "success" => true,
                    "message" => "Church settings created successfully."
                ]);
            } else {
                http_response_code(503);
                echo json_encode([
                    "success" => false,
                    "message" => "Unable to create church settings."
                ]);
            }
        }
    } else {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Church name is required."
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


<?php
// Add CORS headers for cross-origin requests
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get limit from query parameter (default 5)
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
    
    // Get upcoming birthdays sorted by nearest first
    $query = "SELECT 
                id,
                CONCAT(first_name, ' ', 
                       CASE WHEN middle_name IS NOT NULL AND middle_name != '' 
                            THEN CONCAT(SUBSTRING(middle_name, 1, 1), '. ') 
                            ELSE '' 
                       END,
                       surname,
                       CASE WHEN suffix != 'None' AND suffix IS NOT NULL 
                            THEN CONCAT(' ', suffix) 
                            ELSE '' 
                       END) as full_name,
                first_name,
                surname,
                profile_picture,
                birthday,
                DAYOFMONTH(birthday) as day,
                MONTH(birthday) as month,
                CASE 
                    WHEN DATE_FORMAT(birthday, '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
                    THEN DATEDIFF(
                        DATE_FORMAT(CONCAT(YEAR(CURDATE()), '-', DATE_FORMAT(birthday, '%m-%d')), '%Y-%m-%d'),
                        CURDATE()
                    )
                    ELSE DATEDIFF(
                        DATE_FORMAT(CONCAT(YEAR(CURDATE()) + 1, '-', DATE_FORMAT(birthday, '%m-%d')), '%Y-%m-%d'),
                        CURDATE()
                    )
                END as days_until
              FROM members
              WHERE birthday IS NOT NULL
              ORDER BY days_until ASC
              LIMIT :limit";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $birthdays = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format birthdays with days until
    $formattedBirthdays = array_map(function($member) {
        $today = new DateTime('today');
        $thisYear = (int)$today->format('Y');
        
        // Create birthday date for this year
        $birthdayThisYear = DateTime::createFromFormat('Y-m-d', $thisYear . '-' . str_pad($member['month'], 2, '0', STR_PAD_LEFT) . '-' . str_pad($member['day'], 2, '0', STR_PAD_LEFT));
        
        // If birthday already passed this year, use next year
        if ($birthdayThisYear < $today) {
            $birthdayThisYear->modify('+1 year');
        }
        
        // Calculate days until birthday
        $interval = $today->diff($birthdayThisYear);
        $daysUntil = $interval->days;
        
        // Get initials
        $firstInitial = substr($member['first_name'], 0, 1);
        $lastInitial = substr($member['surname'], 0, 1);
        $initials = strtoupper($firstInitial . $lastInitial);
        
        // Format date
        $birthdayDate = $birthdayThisYear->format('F j');
        
        return [
            'id' => (int)$member['id'],
            'name' => $member['full_name'],
            'initials' => $initials,
            'date' => $birthdayDate,
            'daysUntil' => (int)$daysUntil,
            'profilePicture' => $member['profile_picture'] ?? null
        ];
    }, $birthdays);
    
    echo json_encode([
        'success' => true,
        'birthdays' => $formattedBirthdays
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>

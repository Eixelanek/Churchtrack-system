<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (empty($data->member_id) || empty($data->relative_id)) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Member ID and relative ID are required"
    ]);
    exit();
}

try {
    $memberId = (int)$data->member_id;
    $relativeId = (int)$data->relative_id;

    // Find the relationship (bidirectional)
    $findQuery = "SELECT id, status FROM family_relationships 
                  WHERE (member_id = :member_id AND relative_id = :relative_id)
                     OR (member_id = :relative_id AND relative_id = :member_id)";

    $findStmt = $db->prepare($findQuery);
    $findStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $findStmt->bindParam(':relative_id', $relativeId, PDO::PARAM_INT);
    $findStmt->execute();

    if ($findStmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "error" => true,
            "message" => "Relationship not found"
        ]);
        exit();
    }

    // Soft delete: update all matching rows to 'removed'
    $removeQuery = "UPDATE family_relationships 
                    SET status = 'removed', responded_at = NOW() 
                    WHERE (member_id = :member_id AND relative_id = :relative_id)
                       OR (member_id = :relative_id AND relative_id = :member_id)";

    $removeStmt = $db->prepare($removeQuery);
    $removeStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $removeStmt->bindParam(':relative_id', $relativeId, PDO::PARAM_INT);

    if ($removeStmt->execute()) {
        try {
            $nameQuery = "SELECT id, first_name, middle_name, surname, suffix FROM members WHERE id IN (:member_id, :relative_id)";
            $nameStmt = $db->prepare($nameQuery);
            $nameStmt->bindValue(':member_id', $memberId, PDO::PARAM_INT);
            $nameStmt->bindValue(':relative_id', $relativeId, PDO::PARAM_INT);
            $nameStmt->execute();

            $names = [];
            while ($row = $nameStmt->fetch(PDO::FETCH_ASSOC)) {
                $parts = array_filter([
                    $row['first_name'] ?? null,
                    isset($row['middle_name']) && trim($row['middle_name']) !== '' ? substr(trim($row['middle_name']), 0, 1) . '.' : null,
                    $row['surname'] ?? null,
                    (isset($row['suffix']) && strtolower(trim($row['suffix'])) !== 'none' && trim($row['suffix']) !== '') ? trim($row['suffix']) : null
                ]);
                $names[(int)$row['id']] = implode(' ', $parts);
            }

            $primaryName = $names[$memberId] ?? 'Member #' . $memberId;
            $relativeName = $names[$relativeId] ?? 'Member #' . $relativeId;

            $removeMessage = sprintf(
                'Family circle removed between %s and %s.',
                $primaryName,
                $relativeName
            );

            $notificationInsert = "INSERT INTO notifications (type, message, event_id, member_id) VALUES ('family_circle_removed', :message, NULL, :member_id)";
            $notificationStmt = $db->prepare($notificationInsert);
            $notificationStmt->bindParam(':message', $removeMessage);
            $notificationStmt->bindValue(':member_id', $memberId, PDO::PARAM_INT);
            $notificationStmt->execute();
        } catch (Exception $notificationError) {
            error_log('Failed to create family circle removed notification: ' . $notificationError->getMessage());
        }

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Family relationship removed successfully"
        ]);
    } else {
        throw new Exception("Failed to remove relationship");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error removing relationship: " . $e->getMessage()
    ]);
}
?>

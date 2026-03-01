<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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
if (empty($data->invite_id) || empty($data->responder_id) || empty($data->action)) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Invite ID, responder ID, and action are required"
    ]);
    exit();
}

try {
    $inviteId = (int)$data->invite_id;
    $responderId = (int)$data->responder_id;
    $action = strtolower(trim($data->action));

    // Validate action
    if (!in_array($action, ['accept', 'decline'])) {
        http_response_code(400);
        echo json_encode([
            "error" => true,
            "message" => "Action must be 'accept' or 'decline'"
        ]);
        exit();
    }

    // Get invitation details
    $getQuery = "SELECT id, member_id, relative_id, relationship_type, status 
                 FROM family_relationships 
                 WHERE id = :invite_id";
    $getStmt = $db->prepare($getQuery);
    $getStmt->bindParam(':invite_id', $inviteId, PDO::PARAM_INT);
    $getStmt->execute();

    if ($getStmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "error" => true,
            "message" => "Invitation not found"
        ]);
        exit();
    }

    $invite = $getStmt->fetch(PDO::FETCH_ASSOC);

    // Verify responder is the invited person
    if ((int)$invite['relative_id'] !== $responderId) {
        http_response_code(403);
        echo json_encode([
            "error" => true,
            "message" => "You are not authorized to respond to this invitation"
        ]);
        exit();
    }

    // Check if already responded
    if ($invite['status'] !== 'pending') {
        http_response_code(400);
        echo json_encode([
            "error" => true,
            "message" => "This invitation has already been responded to"
        ]);
        exit();
    }

    // Update invitation status
    $newStatus = $action === 'accept' ? 'accepted' : 'declined';
    $updateQuery = "UPDATE family_relationships 
                    SET status = :status, responded_at = NOW() 
                    WHERE id = :invite_id";
    
    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->bindParam(':status', $newStatus);
    $updateStmt->bindParam(':invite_id', $inviteId, PDO::PARAM_INT);

    if ($updateStmt->execute()) {
        if ($newStatus === 'accepted') {
            try {
                $memberInfoQuery = "SELECT id, first_name, middle_name, surname, suffix FROM members WHERE id IN (:member_id, :relative_id)";
                $memberInfoStmt = $db->prepare($memberInfoQuery);
                $primaryMemberId = (int)$invite['member_id'];
                $relativeMemberId = (int)$invite['relative_id'];
                $memberInfoStmt->bindValue(':member_id', $primaryMemberId, PDO::PARAM_INT);
                $memberInfoStmt->bindValue(':relative_id', $relativeMemberId, PDO::PARAM_INT);
                $memberInfoStmt->execute();

                $membersById = [];
                while ($row = $memberInfoStmt->fetch(PDO::FETCH_ASSOC)) {
                    $nameParts = array_filter([
                        $row['first_name'] ?? null,
                        isset($row['middle_name']) && trim($row['middle_name']) !== '' ? substr(trim($row['middle_name']), 0, 1) . '.' : null,
                        $row['surname'] ?? null,
                        (isset($row['suffix']) && strtolower(trim($row['suffix'])) !== 'none' && trim($row['suffix']) !== '') ? trim($row['suffix']) : null
                    ]);
                    $membersById[(int)$row['id']] = implode(' ', $nameParts);
                }

                $primaryName = $membersById[$primaryMemberId] ?? 'Member #' . $primaryMemberId;
                $relativeName = $membersById[$relativeMemberId] ?? 'Member #' . $relativeMemberId;

                $relationshipLabel = $invite['relationship_type'] ?? '';
                $relationshipLabel = $relationshipLabel !== ''
                    ? ucwords(str_replace('_', ' ', $relationshipLabel))
                    : 'Family';

                $notificationMessage = sprintf(
                    '%s is now connected to %s as %s.',
                    $relativeName,
                    $primaryName,
                    $relationshipLabel
                );

                $notificationInsert = "INSERT INTO notifications (type, message, event_id, member_id) VALUES ('family_circle_created', :message, NULL, :member_id)";
                $notificationStmt = $db->prepare($notificationInsert);
                $notificationStmt->bindParam(':message', $notificationMessage);
                $notificationStmt->bindValue(':member_id', $primaryMemberId, PDO::PARAM_INT);
                $notificationStmt->execute();
            } catch (Exception $notificationError) {
                error_log('Failed to create family circle created notification: ' . $notificationError->getMessage());
            }
        }

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Invitation " . ($action === 'accept' ? 'accepted' : 'declined') . " successfully",
            "status" => $newStatus
        ]);
    } else {
        throw new Exception("Failed to update invitation status");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error responding to invitation: " . $e->getMessage()
    ]);
}
?>

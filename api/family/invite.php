<?php
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
if (empty($data->inviter_id) || empty($data->relative_id) || empty($data->relationship_type)) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Inviter ID, relative ID, and relationship type are required"
    ]);
    exit();
}

try {
    $inviterId = (int)$data->inviter_id;
    $relativeId = (int)$data->relative_id;
    $relationshipType = htmlspecialchars(strip_tags($data->relationship_type));
    $notes = !empty($data->notes) ? htmlspecialchars(strip_tags($data->notes)) : null;

    // Validate relationship type
    $validRelationships = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];
    if (!in_array($relationshipType, $validRelationships)) {
        http_response_code(400);
        echo json_encode([
            "error" => true,
            "message" => "Invalid relationship type"
        ]);
        exit();
    }

    // Prevent self-invite
    if ($inviterId === $relativeId) {
        http_response_code(400);
        echo json_encode([
            "error" => true,
            "message" => "Cannot invite yourself"
        ]);
        exit();
    }

    // Check if both members exist
    $checkQuery = "SELECT id FROM members WHERE id IN (:inviter_id, :relative_id)";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':inviter_id', $inviterId, PDO::PARAM_INT);
    $checkStmt->bindParam(':relative_id', $relativeId, PDO::PARAM_INT);
    $checkStmt->execute();

    if ($checkStmt->rowCount() < 2) {
        http_response_code(404);
        echo json_encode([
            "error" => true,
            "message" => "One or both members not found"
        ]);
        exit();
    }

    // Check for existing relationship (any status)
    $existingQuery = "SELECT id, member_id, relative_id, status FROM family_relationships 
                      WHERE (member_id = :inviter_id AND relative_id = :relative_id)
                         OR (member_id = :relative_id AND relative_id = :inviter_id)";
    $existingStmt = $db->prepare($existingQuery);
    $existingStmt->bindParam(':inviter_id', $inviterId, PDO::PARAM_INT);
    $existingStmt->bindParam(':relative_id', $relativeId, PDO::PARAM_INT);
    $existingStmt->execute();

    $reactivateId = null;

    while ($existing = $existingStmt->fetch(PDO::FETCH_ASSOC)) {
        $status = strtolower($existing['status'] ?? '');

        if ($status === 'pending') {
            http_response_code(400);
            echo json_encode([
                "error" => true,
                "message" => "A pending invitation already exists between these members"
            ]);
            exit();
        }

        if ($status === 'accepted') {
            http_response_code(400);
            echo json_encode([
                "error" => true,
                "message" => "These members are already connected"
            ]);
            exit();
        }

        if (in_array($status, ['removed', 'declined'], true)
            && (int)$existing['member_id'] === $inviterId
            && (int)$existing['relative_id'] === $relativeId) {
            $reactivateId = (int)$existing['id'];
        }
    }

    $existingStmt->closeCursor();

    // Resolve inviter display name for notifications
    $inviterNameQuery = "SELECT
                            COALESCE(NULLIF(TRIM(full_name), ''), CONCAT(first_name, ' ', surname)) AS name
                         FROM members 
                         WHERE id = :inviter_id 
                         LIMIT 1";
    $inviterNameStmt = $db->prepare($inviterNameQuery);
    $inviterNameStmt->bindParam(':inviter_id', $inviterId, PDO::PARAM_INT);
    $inviterNameStmt->execute();
    $inviterNameResult = $inviterNameStmt->fetch(PDO::FETCH_ASSOC);
    $inviterName = $inviterNameResult && !empty($inviterNameResult['name'])
        ? $inviterNameResult['name']
        : 'A church member';

    if ($reactivateId !== null) {
        $reactivateQuery = "UPDATE family_relationships 
                            SET relationship_type = :relationship_type,
                                status = 'pending',
                                notes = :notes,
                                initiated_at = NOW(),
                                responded_at = NULL
                            WHERE id = :id";

        $reactivateStmt = $db->prepare($reactivateQuery);
        $reactivateStmt->bindParam(':relationship_type', $relationshipType);
        if ($notes !== null) {
            $reactivateStmt->bindParam(':notes', $notes);
        } else {
            $reactivateStmt->bindValue(':notes', null, PDO::PARAM_NULL);
        }
        $reactivateStmt->bindParam(':id', $reactivateId, PDO::PARAM_INT);

        if ($reactivateStmt->execute()) {
            // Notify the invited member again
            try {
                $notificationMessage = sprintf(
                    "%s invited you to join their family circle as %s.",
                    $inviterName,
                    $relationshipType
                );

                $notifQuery = "INSERT INTO member_notifications 
                                   (member_id, type, message, event_id, related_member_id)
                               VALUES 
                                   (:member_id, 'family_invite', :message, NULL, :related_member_id)";
                $notifStmt = $db->prepare($notifQuery);
                $notifStmt->bindParam(':member_id', $relativeId, PDO::PARAM_INT);
                $notifStmt->bindParam(':message', $notificationMessage);
                $notifStmt->bindParam(':related_member_id', $inviterId, PDO::PARAM_INT);
                $notifStmt->execute();
            } catch (Exception $notifError) {
                error_log('Failed to queue family invite notification: ' . $notifError->getMessage());
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "message" => "Family invitation sent successfully",
                "invite_id" => $reactivateId,
                "reactivated" => true
            ]);
            exit();
        } else {
            throw new Exception("Failed to update existing invitation");
        }
    }

    // Insert invitation
    $insertQuery = "INSERT INTO family_relationships 
                    (member_id, relative_id, relationship_type, status, notes)
                    VALUES (:inviter_id, :relative_id, :relationship_type, 'pending', :notes)";
    
    $insertStmt = $db->prepare($insertQuery);
    $insertStmt->bindParam(':inviter_id', $inviterId, PDO::PARAM_INT);
    $insertStmt->bindParam(':relative_id', $relativeId, PDO::PARAM_INT);
    $insertStmt->bindParam(':relationship_type', $relationshipType);
    $insertStmt->bindParam(':notes', $notes);

    if ($insertStmt->execute()) {
        $inviteId = $db->lastInsertId();

        // Notify the invited member
        try {
            $notificationMessage = sprintf(
                "%s invited you to join their family circle as %s.",
                $inviterName,
                $relationshipType
            );

            $notifQuery = "INSERT INTO member_notifications 
                               (member_id, type, message, event_id, related_member_id)
                           VALUES 
                               (:member_id, 'family_invite', :message, NULL, :related_member_id)";
            $notifStmt = $db->prepare($notifQuery);
            $notifStmt->bindParam(':member_id', $relativeId, PDO::PARAM_INT);
            $notifStmt->bindParam(':message', $notificationMessage);
            $notifStmt->bindParam(':related_member_id', $inviterId, PDO::PARAM_INT);
            $notifStmt->execute();
        } catch (Exception $notifError) {
            error_log('Failed to queue family invite notification: ' . $notifError->getMessage());
        }

        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Family invitation sent successfully",
            "invite_id" => $inviteId
        ]);
    } else {
        throw new Exception("Failed to create invitation");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error sending invitation: " . $e->getMessage()
    ]);
}
?>

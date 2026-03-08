<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

function mapRelationshipForViewer($original, $isViewerPrimary, $otherGender = null, $viewerGender = null) {
    if ($isViewerPrimary) {
        return $original;
    }

    $relation = strtolower($original ?? '');
    $otherGenderLower = strtolower($otherGender ?? '');
    $viewerGenderLower = strtolower($viewerGender ?? '');

    switch ($relation) {
        case 'son':
        case 'daughter':
            if ($otherGenderLower === 'female') {
                return 'Mother';
            }
            if ($otherGenderLower === 'male') {
                return 'Father';
            }
            return 'Parent';
        case 'father':
        case 'mother':
            if ($viewerGenderLower === 'female') {
                return 'Daughter';
            }
            if ($viewerGenderLower === 'male') {
                return 'Son';
            }
            return 'Child';
        case 'brother':
        case 'sister':
            return 'Sibling';
        case 'other':
            return 'Family';
        default:
            return $original;
    }
}

// Get member ID from query parameter
$memberId = isset($_GET['member_id']) ? (int)$_GET['member_id'] : null;

if (!$memberId) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Member ID is required"
    ]);
    exit();
}

try {
    // Get pending invitations sent by this member
    $pendingSentQuery = "SELECT 
                            fr.id,
                            fr.relative_id as member_id,
                            m.full_name as member_name,
                            m.email,
                            m.profile_picture,
                            fr.relationship_type,
                            fr.initiated_at,
                            fr.notes
                         FROM family_relationships fr
                         INNER JOIN members m ON m.id = fr.relative_id
                         WHERE fr.member_id = :member_id 
                           AND fr.status = 'pending'
                         ORDER BY fr.initiated_at DESC";
    
    $pendingSentStmt = $db->prepare($pendingSentQuery);
    $pendingSentStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $pendingSentStmt->execute();
    $pendingSent = $pendingSentStmt->fetchAll(PDO::FETCH_ASSOC);

    // Get pending invitations received by this member
    $pendingReceivedQuery = "SELECT 
                                fr.id,
                                fr.member_id,
                                m.full_name as member_name,
                                m.email,
                                m.profile_picture,
                                fr.relationship_type,
                                fr.initiated_at,
                                fr.notes
                             FROM family_relationships fr
                             INNER JOIN members m ON m.id = fr.member_id
                             WHERE fr.relative_id = :member_id 
                               AND fr.status = 'pending'
                             ORDER BY fr.initiated_at DESC";
    
    $pendingReceivedStmt = $db->prepare($pendingReceivedQuery);
    $pendingReceivedStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $pendingReceivedStmt->execute();
    $pendingReceived = $pendingReceivedStmt->fetchAll(PDO::FETCH_ASSOC);

    // Get accepted family members (bidirectional)
    $familyQuery = "SELECT 
                        fr.id,
                        CASE 
                            WHEN fr.member_id = :member_id THEN fr.relative_id
                            ELSE fr.member_id
                        END as member_id,
                        CASE 
                            WHEN fr.member_id = :member_id THEN m2.full_name
                            ELSE m1.full_name
                        END as member_name,
                        CASE 
                            WHEN fr.member_id = :member_id THEN m2.email
                            ELSE m1.email
                        END as email,
                        CASE 
                            WHEN fr.member_id = :member_id THEN m2.profile_picture
                            ELSE m1.profile_picture
                        END as profile_picture,
                        CASE 
                            WHEN fr.member_id = :member_id THEN m2.gender
                            ELSE m1.gender
                        END as member_gender,
                        CASE 
                            WHEN fr.member_id = :member_id THEN m1.gender
                            ELSE m2.gender
                        END as viewer_gender,
                        CASE 
                            WHEN fr.member_id = :member_id THEN m2.birthday
                            ELSE m1.birthday
                        END as birthday,
                        fr.relationship_type,
                        fr.responded_at,
                        fr.notes,
                        fr.member_id as relationship_owner_id,
                        fr.relative_id as relationship_relative_id
                    FROM family_relationships fr
                    INNER JOIN members m1 ON m1.id = fr.member_id
                    INNER JOIN members m2 ON m2.id = fr.relative_id
                    WHERE (fr.member_id = :member_id OR fr.relative_id = :member_id)
                      AND fr.status = 'accepted'
                    ORDER BY fr.responded_at DESC";
    
    $familyStmt = $db->prepare($familyQuery);
    $familyStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $familyStmt->execute();
    $family = $familyStmt->fetchAll(PDO::FETCH_ASSOC);

    // Organize family into tree structure
    $tree = [
        'parents' => [],
        'couple' => [],
        'siblings' => [],
        'children' => [],
        'other' => []
    ];

    $normalizedFamily = [];

    foreach ($family as $member) {
        $isViewerPrimary = ((int)$member['relationship_owner_id'] === $memberId);
        $displayRelation = mapRelationshipForViewer(
            $member['relationship_type'],
            $isViewerPrimary,
            $member['member_gender'] ?? null,
            $member['viewer_gender'] ?? null
        );

        $memberData = [
            'id' => $member['member_id'],
            'name' => $member['member_name'],
            'relation' => $displayRelation,
            'email' => $member['email'],
            'profile_picture' => $member['profile_picture'] ?? null,
            'birthday' => $member['birthday'] ?? null
        ];

        $normalizedFamily[] = [
            'id' => $member['id'],
            'member_id' => $member['member_id'],
            'member_name' => $member['member_name'],
            'email' => $member['email'],
            'profile_picture' => $member['profile_picture'] ?? null,
            'relationship_type' => $displayRelation,
            'relationship_type_raw' => $member['relationship_type'],
            'responded_at' => $member['responded_at'],
            'notes' => $member['notes'],
            'member_gender' => $member['member_gender'],
            'viewer_gender' => $member['viewer_gender'],
            'relationship_owner_id' => $member['relationship_owner_id'],
            'relationship_relative_id' => $member['relationship_relative_id']
        ];

        if (in_array($displayRelation, ['Father', 'Mother'])) {
            $tree['parents'][] = $memberData;
        } elseif ($displayRelation === 'Spouse') {
            $tree['couple'][] = $memberData;
        } elseif (in_array($displayRelation, ['Brother', 'Sister', 'Sibling'])) {
            $tree['siblings'][] = $memberData;
        } elseif (in_array($displayRelation, ['Son', 'Daughter', 'Child'])) {
            $tree['children'][] = $memberData;
        } else {
            $tree['other'][] = $memberData;
        }
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "pending_sent" => $pendingSent,
        "pending_received" => $pendingReceived,
        "family" => $normalizedFamily,
        "tree" => $tree
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching family relationships: " . $e->getMessage()
    ]);
}
?>

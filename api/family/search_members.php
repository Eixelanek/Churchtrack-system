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

// Get search query and current member ID
$searchQuery = isset($_GET['q']) ? trim($_GET['q']) : '';
$currentMemberId = isset($_GET['current_member_id']) ? (int)$_GET['current_member_id'] : null;

if (empty($searchQuery)) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Search query is required"
    ]);
    exit();
}

try {
    $searchTerm = '%' . $searchQuery . '%';
    
    // Search members by name or email, exclude current member
    $query = "SELECT 
                id,
                full_name,
                email,
                status
              FROM members
              WHERE (full_name LIKE :search_term OR email LIKE :search_term)
                AND status IN ('Active', 'Inactive')";
    
    if ($currentMemberId) {
        $query .= " AND id != :current_member_id";
    }
    
    $query .= " ORDER BY full_name ASC LIMIT 20";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':search_term', $searchTerm);
    
    if ($currentMemberId) {
        $stmt->bindParam(':current_member_id', $currentMemberId, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // If current member is provided, check existing relationships
    if ($currentMemberId && !empty($results)) {
        $memberIds = array_column($results, 'id');
        $placeholders = implode(',', array_fill(0, count($memberIds), '?'));
        
        $relationshipQuery = "SELECT 
                                CASE 
                                    WHEN member_id = ? THEN relative_id
                                    ELSE member_id
                                END as related_member_id,
                                status
                              FROM family_relationships
                              WHERE (member_id = ? OR relative_id = ?)
                                AND (member_id IN ($placeholders) OR relative_id IN ($placeholders))";
        
        $relStmt = $db->prepare($relationshipQuery);
        $relStmt->execute(array_merge(
            [$currentMemberId, $currentMemberId, $currentMemberId],
            $memberIds,
            $memberIds
        ));
        
        $relationships = [];
        while ($row = $relStmt->fetch(PDO::FETCH_ASSOC)) {
            $relatedId = (int)$row['related_member_id'];
            $status = $row['status'];

            if (strcasecmp($status, 'removed') === 0) {
                // Treat removed relationships as cleared so reinvite is allowed
                continue;
            }

            // Prefer keeping the most recent non-removed status if multiple entries exist
            if (!isset($relationships[$relatedId]) || strcasecmp($relationships[$relatedId], 'accepted') !== 0) {
                $relationships[$relatedId] = $status;
            }
        }
        
        // Add relationship status to results
        foreach ($results as &$member) {
            $member['relationship_status'] = $relationships[(int)$member['id']] ?? null;
        }
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "count" => count($results),
        "members" => $results
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error searching members: " . $e->getMessage()
    ]);
}
?>

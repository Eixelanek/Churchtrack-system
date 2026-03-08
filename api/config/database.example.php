<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
class Database {
    // Update these values for your hosting environment
    private $host = "localhost";           // Usually "localhost" or provided by host
    private $db_name = "your_database";    // Your database name
    private $username = "your_username";   // Your database username
    private $password = "your_password";   // Your database password
    public $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
        } catch(PDOException $e) {
            // In production, log this instead of displaying
            error_log("Connection error: " . $e->getMessage());
            die(json_encode([
                'success' => false, 
                'message' => 'Database connection failed. Please contact administrator.'
            ]));
        }

        return $this->conn;
    }
}
?>

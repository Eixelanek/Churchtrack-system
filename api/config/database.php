<?php
class Database {
    private $host = "churchtrack-db-churchtrack.a.aivencloud.com";
    private $port = "17629";
    private $db_name = "defaultdb";
    private $username = "avnadmin";
    private $password = "AVNS_YXyhc87L5iDG6SRQ4cg";  // Aiven password
    public $conn;

    public function getConnection() {
        $this->conn = null;

        // Use environment variable if available (for Render deployment)
        $host = getenv('DB_HOST') ?: $this->host;
        $port = getenv('DB_PORT') ?: $this->port;
        $db_name = getenv('DB_NAME') ?: $this->db_name;
        $username = getenv('DB_USER') ?: $this->username;
        $password = getenv('DB_PASSWORD') ?: $this->password;

        try {
            $this->conn = new PDO(
                "mysql:host=$host;port=$port;dbname=$db_name",
                $username,
                $password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
        } catch(PDOException $e) {
            error_log("Connection error: " . $e->getMessage());
            die(json_encode([
                'success' => false, 
                'message' => 'Database connection failed. Please check configuration.'
            ]));
        }

        return $this->conn;
    }
}
?> 
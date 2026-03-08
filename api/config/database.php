<?php
// Add CORS headers for cross-origin requests

class Database {
    private $host;
    private $port;
    private $db_name;
    private $username;
    private $password;
    public $conn;

    public function __construct() {
        // Check if running on Render or Railway (environment variables set)
        if (getenv('RENDER') || getenv('DB_HOST') || getenv('RAILWAY_ENVIRONMENT')) {
            // Render/Railway configuration
            $this->host = getenv('DB_HOST') ?: getenv('MYSQLHOST');
            $this->port = getenv('DB_PORT') ?: getenv('MYSQLPORT') ?: '3306';
            $this->db_name = getenv('DB_NAME') ?: getenv('MYSQLDATABASE') ?: 'churchtrack';
            $this->username = getenv('DB_USER') ?: getenv('MYSQLUSER');
            $this->password = getenv('DB_PASSWORD') ?: getenv('MYSQLPASSWORD');
            
            // Fallback: If hostname is Aiven and can't resolve, use IP
            if (strpos($this->host, 'aivencloud.com') !== false) {
                // Try to resolve hostname, if fails use IP
                if (!gethostbyname($this->host)) {
                    $this->host = '139.59.39.227'; // Aiven IP address
                }
            }
        } else {
            // Aiven MySQL Configuration (fallback)
            $this->host = "churchtrack-db-churchtrack.a.aivencloud.com";
            $this->port = "17629";
            $this->db_name = "defaultdb";
            $this->username = "avnadmin";
            $this->password = "AVNS_YXyhc87L5iDG6SRQ4cg";
        }
    }

    public function getConnection() {
        $this->conn = null;

        try {
            // For Aiven, we need to use sslmode in the DSN
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name};charset=utf8mb4";
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 10,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4",
                PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false
            ];
            
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch(PDOException $e) {
            error_log("Connection error: " . $e->getMessage());
            error_log("DSN: mysql:host={$this->host};port={$this->port};dbname={$this->db_name}");
            error_log("Host: {$this->host}, Port: {$this->port}, DB: {$this->db_name}, User: {$this->username}");
            die(json_encode([
                'success' => false, 
                'message' => 'Database connection failed. Please check configuration.',
                'error' => $e->getMessage()
            ]));
        }

        return $this->conn;
    }
}
?>
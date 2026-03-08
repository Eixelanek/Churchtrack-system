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
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name}";
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
                PDO::MYSQL_ATTR_SSL_CA => false
            ];
            
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            $this->conn->exec("set names utf8mb4");
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
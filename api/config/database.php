<?php
// Add CORS headers for cross-origin requests

// Ensure all PHP date/time functions use Philippine time
date_default_timezone_set('Asia/Manila');

class Database {
    private $host;
    private $port;
    private $db_name;
    private $username;
    private $password;
    public $conn;

    public function __construct() {
        // Priority 1: Check environment variables (for Render, Railway, or custom deployment)
        if (getenv('DB_HOST')) {
            $this->host = getenv('DB_HOST');
            $this->port = getenv('DB_PORT') ?: '3306';
            $this->db_name = getenv('DB_NAME');
            $this->username = getenv('DB_USER');
            $this->password = getenv('DB_PASSWORD');
        } 
        // Priority 2: Check Railway environment variables
        elseif (getenv('RAILWAY_ENVIRONMENT')) {
            $this->host = getenv('MYSQLHOST');
            $this->port = getenv('MYSQLPORT') ?: '3306';
            $this->db_name = getenv('MYSQLDATABASE');
            $this->username = getenv('MYSQLUSER');
            $this->password = getenv('MYSQLPASSWORD');
        }
        // Priority 3: Hostinger local database (default for shared hosting)
        else {
            $this->host = "localhost";
            $this->port = "3306";
            $this->db_name = "u123456789_churchtrack"; // Update with your actual database name
            $this->username = "u123456789_churchtrack"; // Update with your actual username
            $this->password = ""; // Update with your actual password from Hostinger
        }
    }

    public function getConnection() {
        $this->conn = null;

        try {
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name}";
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
            // Set timezone to Philippines
            $this->conn->exec("SET time_zone = '+08:00'");
        } catch(PDOException $e) {
            error_log("Connection error: " . $e->getMessage());
            error_log("DSN: mysql:host={$this->host};port={$this->port};dbname={$this->db_name}");
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
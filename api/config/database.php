<?php
class Database {
    // InfinityFree MySQL Configuration
    private $host = "sql110.infinityfree.com";
    private $port = "3306";
    private $db_name = "if0_41276444_ChurchTrack";
    private $username = "if0_41276444";
    private $password = "FQdKr0jjkK";
    public $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host={$this->host};port={$this->port};dbname={$this->db_name}",
                $this->username,
                $this->password
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
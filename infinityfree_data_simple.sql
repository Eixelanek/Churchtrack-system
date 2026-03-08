-- Simple data import for InfinityFree (tables already created)
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- Clear existing data
TRUNCATE TABLE `admin`;
TRUNCATE TABLE `members`;
TRUNCATE TABLE `events`;
TRUNCATE TABLE `qr_sessions`;
TRUNCATE TABLE `qr_attendance`;
TRUNCATE TABLE `church_settings`;
TRUNCATE TABLE `admin_sessions`;
TRUNCATE TABLE `login_history`;
TRUNCATE TABLE `member_notifications`;
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `notification_reads`;
TRUNCATE TABLE `password_reset_requests`;

-- Admin users
INSERT INTO `admin` (`id`, `username`, `password`, `first_name`, `last_name`, `birthday`, `profile_picture`, `role`, `created_at`) VALUES
(1, 'admin', '$2y$10$YourHashedPasswordHere', NULL, NULL, NULL, NULL, 'admin', '2024-03-07 16:34:40'),
(4, 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', '1990-01-01', NULL, 'admin', '2024-03-08 01:51:42');

-- Church settings
INSERT INTO `church_settings` (`id`, `church_name`, `church_address`, `church_phone`, `church_email`, `church_logo`, `homepage_images`, `updated_at`) VALUES
(1, 'Christ the Living Church Community', 'Church Address Here', '09123456789', 'church@email.com', NULL, NULL, CURRENT_TIMESTAMP);

SET FOREIGN_KEY_CHECKS = 1;

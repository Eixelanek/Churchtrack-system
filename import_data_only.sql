-- Import data only (tables already created)
SET FOREIGN_KEY_CHECKS = 0;

-- Admin data
INSERT INTO `admin` (`id`, `username`, `password`, `first_name`, `last_name`, `birthday`, `profile_picture`, `role`, `created_at`) VALUES
(1, 'admin', '$2y$10$YourHashedPasswordHere', NULL, NULL, NULL, NULL, 'admin', '2024-03-07 16:34:40'),
(4, 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', '1990-01-01', NULL, 'admin', '2024-03-08 01:51:42');

-- Members data (you'll need to get this from your Aiven database)
-- Use phpMyAdmin to export just the members table data

-- Church settings
INSERT INTO `church_settings` (`id`, `church_name`, `church_address`, `church_phone`, `church_email`, `church_logo`, `homepage_images`, `updated_at`) VALUES
(1, 'Your Church Name', 'Church Address', '123-456-7890', 'church@email.com', NULL, NULL, CURRENT_TIMESTAMP);

SET FOREIGN_KEY_CHECKS = 1;

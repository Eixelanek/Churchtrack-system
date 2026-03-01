-- Create notification_reads table to track which user has read which notification
-- This allows admin and manager to have separate read/unread states for the same notification
CREATE TABLE IF NOT EXISTS `notification_reads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `notification_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `user_type` varchar(20) NOT NULL COMMENT 'admin or manager',
  `read_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_notification_user` (`notification_id`, `user_id`, `user_type`),
  KEY `notification_id` (`notification_id`),
  KEY `user_id` (`user_id`),
  KEY `user_type` (`user_type`),
  FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

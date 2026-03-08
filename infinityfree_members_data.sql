-- Members Data
INSERT INTO `members` (`id`, `first_name`, `middle_name`, `surname`, `suffix`, `birthday`, `age`, `gender`, `address`, `contact_number`, `email`, `username`, `password`, `profile_picture`, `status`, `is_manager`, `referred_by`, `referrer_name`, `guardian_name`, `relationship_to_guardian`, `inactive_reason`, `inactive_date`, `created_at`, `updated_at`) VALUES
(64, 'Lorenzo', 'Martin', 'Andrada', 'None', '1990-11-11', NULL, 'Male', '', '09170000001', 'lorenzo.andrada@example.com', 'lorenzoandrada', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', '/uploads/profile_pictures/member_64_1762859068.jpeg', 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-01 00:00:00', '2025-11-12 08:10:12'),
(65, 'Maria', 'Lopez', 'Reyes', 'None', '1992-03-22', NULL, 'Female', '', '09170000002', 'maria.reyes@example.com', 'mariareyes', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', NULL, 'inactive', , NULL, NULL, NULL, NULL, NULL, NULL, '2024-01-01 00:00:00', '2025-11-09 15:37:26'),
(66, 'Carlos', NULL, 'Santiago', 'None', '1988-07-05', NULL, 'Male', '', '09170000003', 'jl123@example.com', 'carlossantiago', '$2y$10$hK52OPnx0xlw0ezt8ZRwfuXZfHOQC1tkQ81dbmhqA92gm4mti8t/y', '/uploads/profile_pictures/member_66_1772943541.jpeg', 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2024-01-01 00:00:00', '2026-03-08 04:19:01'),
(67, 'Ana', 'Fernandez', 'Garcia', 'None', '1994-11-11', NULL, 'Female', '', '09170000004', 'ana.garcia@example.com', 'anagarcia', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', '/uploads/profile_pictures/member_67_1762857237.jpeg', 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-03 00:00:00', '2025-11-12 08:10:12'),
(68, 'Miguel', 'Domingo', 'Torres', 'Jr.', '1991-09-09', NULL, 'Male', '', '09170000005', 'miguel.torres@example.com', 'migueltorres', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', NULL, 'inactive', , NULL, NULL, NULL, NULL, NULL, NULL, '2024-01-01 00:00:00', '2025-11-09 15:37:26'),
(69, 'Isabella', 'Cruz', 'Flores', 'None', '1993-05-27', NULL, 'Female', '', '09170000006', 'isabella.flores@example.com', 'isabellaflores', '$2y$10$Hli9f4H8TmCzhGM4y7MKNu5iVeO8W2nO63gdHeFBXmFD/QqTVUdjK', '/uploads/profile_pictures/member_69_1762858676.jpeg', 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-29 00:00:00', '2025-11-14 20:26:44'),
(70, 'Jose', 'Aquino', 'Navarro', 'None', '1987-02-14', NULL, 'Male', '', '09170000007', 'jose.navarro@example.com', 'josenavarro', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', NULL, 'inactive', , NULL, NULL, NULL, NULL, NULL, NULL, '2024-01-01 00:00:00', '2025-11-09 15:37:26'),
(71, 'Elena', 'Ramos', 'Santos', 'None', '1990-12-30', NULL, 'Female', '', '09170000008', 'elena.santos@example.com', 'elenasantos', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', '/uploads/profile_pictures/member_71_1762857684.jpeg', 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-09 00:00:00', '2025-11-12 08:10:12'),
(72, 'Rafael', 'Morales', 'Valdez', 'None', '1995-08-03', NULL, 'Male', '', '09170000009', 'rafael.valdez@example.com', 'rafaelvaldez', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', '/uploads/profile_pictures/member_72_1762859265.jpeg', 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-08 00:00:00', '2025-11-12 08:10:12'),
(73, 'Katrina', 'Tan', 'Lim', 'None', '1992-04-12', NULL, 'Female', '', '09170000010', 'katrina.lim@example.com', 'katrlim', '$2y$10$gdUPTPwV.Z/8NQ/yi7tww.Qz.5uKe0ESTIemIopoghfDApNyiCWoS', NULL, 'inactive', , NULL, NULL, NULL, NULL, NULL, NULL, '2024-01-01 00:00:00', '2025-11-09 15:37:26'),
(79, 'Juan', NULL, 'Dela Cruz', 'Jr.', '2002-03-04', NULL, 'Male', '', '09156466571', NULL, 'juan', '$2y$10$dgeMYdlHBE7kvatE6nA.dOaIidHjKWCBaXjcttL.poad.p17GbX8O', NULL, 'active', , NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-12 18:29:41', '2025-11-14 21:12:59');

-- Events Data
INSERT INTO `events` (`id`, `title`, `date`, `time`, `location`, `description`, `type`, `status`, `created_at`, `updated_at`) VALUES
(118, 'Prayer Meeting', '2026-03-08', '', 'QR Session', NULL, '', 'active', '2026-03-08 04:38:42', '2026-03-08 04:38:42'),
(119, 'Prayer Meeting', '2026-03-07', '', 'QR Session', NULL, '', 'completed', '2026-03-08 05:44:21', '2026-03-08 05:44:21');

-- QR Sessions Data
INSERT INTO `qr_sessions` (`id`, `session_code`, `service_name`, `event_type`, `session_type`, `event_datetime`, `location`, `description`, `status`, `created_by`, `created_at`, `ended_at`) VALUES
(102, '', 'Prayer Meeting', 'preset', 'member', '2026-03-08 12:45:00', NULL, NULL, 'active', 2, '2026-03-08 04:38:42', NULL),
(103, '', 'Prayer Meeting', 'preset', 'member', '2026-03-07 19:00:00', NULL, NULL, 'completed', 2, '2026-03-08 05:44:21', NULL);


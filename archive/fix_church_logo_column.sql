-- Fix church_logo column to support large base64 images
-- Run this in phpMyAdmin

ALTER TABLE church_settings 
MODIFY COLUMN church_logo LONGTEXT;

-- Verify the change
DESCRIBE church_settings;

-- Add header_logo column for header-specific branding
ALTER TABLE church_settings 
ADD COLUMN header_logo LONGTEXT NULL AFTER church_logo;

-- Add help center contact columns
ALTER TABLE church_settings 
ADD COLUMN help_center_email VARCHAR(255) NULL AFTER header_logo,
ADD COLUMN help_center_phone VARCHAR(50) NULL AFTER help_center_email,
ADD COLUMN help_center_url VARCHAR(255) NULL AFTER help_center_phone;


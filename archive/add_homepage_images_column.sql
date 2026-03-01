-- Add homepage floating images columns to church_settings table
-- Run this in phpMyAdmin or mysql command line

-- Add columns for 6 floating images
ALTER TABLE church_settings 
ADD COLUMN homepage_image_1 LONGTEXT NULL AFTER date_format,
ADD COLUMN homepage_image_2 LONGTEXT NULL AFTER homepage_image_1,
ADD COLUMN homepage_image_3 LONGTEXT NULL AFTER homepage_image_2,
ADD COLUMN homepage_image_4 LONGTEXT NULL AFTER homepage_image_3,
ADD COLUMN homepage_image_5 LONGTEXT NULL AFTER homepage_image_4,
ADD COLUMN homepage_image_6 LONGTEXT NULL AFTER homepage_image_5;

-- Verify the change
DESCRIBE church_settings;



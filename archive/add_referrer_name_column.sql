-- Add referrer_name column to members table to store referrer name permanently
-- This prevents losing referrer information when the referrer is deleted
-- Run this in phpMyAdmin or mysql command line

ALTER TABLE members 
ADD COLUMN referrer_name VARCHAR(255) NULL AFTER referrer_id;

-- Populate existing records with referrer names
UPDATE members m
LEFT JOIN members r ON m.referrer_id = r.id
SET m.referrer_name = CONCAT(
    r.first_name, ' ',
    COALESCE(CONCAT(r.middle_name, ' '), ''),
    r.surname,
    CASE WHEN r.suffix != 'None' THEN CONCAT(' ', r.suffix) ELSE '' END
)
WHERE m.referrer_id IS NOT NULL AND r.id IS NOT NULL;

-- Verify the change
DESCRIBE members;


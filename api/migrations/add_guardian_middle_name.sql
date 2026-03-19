-- Add guardian_middle_name column to members table if it doesn't exist
-- This migration ensures the guardian middle name field is available for profile updates

-- Check if the column exists and add it if it doesn't
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'members'
    AND COLUMN_NAME = 'guardian_middle_name'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE members ADD COLUMN guardian_middle_name VARCHAR(100) NULL AFTER guardian_first_name',
    'SELECT "Column guardian_middle_name already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update any existing records to ensure consistency
UPDATE members 
SET guardian_middle_name = NULL 
WHERE guardian_middle_name = '';
-- Add parent approval token column for minor registrations
ALTER TABLE members ADD COLUMN parent_approval_token VARCHAR(255) NULL UNIQUE AFTER email_verification_token;

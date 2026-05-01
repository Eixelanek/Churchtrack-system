-- ONE-TIME: Legacy members (before email verification enforcement)
-- Run manually on your DB when existing users get:
--   "Please verify your email before logging in..."
--
-- Effect: marks every member who HAS an email but email_verified_at IS NULL
--         as verified now, and clears pending verification tokens.
-- Members with no email are unchanged (they are not blocked by email verify rules).
--
-- 1) USE your_database_name;
-- 2) Review: SELECT id, username, email, email_verified_at FROM members WHERE email IS NOT NULL AND TRIM(email) <> '' AND email_verified_at IS NULL;
-- 3) Run the UPDATE below.

UPDATE members
SET
    email_verified_at = NOW(),
    email_verification_token = NULL,
    email_verification_expires_at = NULL,
    updated_at = NOW()
WHERE email IS NOT NULL
  AND TRIM(email) <> ''
  AND email_verified_at IS NULL;

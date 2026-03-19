-- Migration 023: Fix verification_codes type CHECK constraint
-- Adds 'two_factor_sms' and 'two_factor_email' to allowed types
-- Required for MFA SMS/email code generation (mfa-manager.ts)
--
-- PostgreSQL only — SQLite CHECK constraints cannot be altered in-place

-- Drop the existing CHECK constraint and add the corrected one
ALTER TABLE verification_codes
  DROP CONSTRAINT IF EXISTS verification_codes_type_check;

ALTER TABLE verification_codes
  ADD CONSTRAINT verification_codes_type_check
  CHECK (type IN ('email_verification', 'password_reset', 'two_factor_backup', 'login_verification', 'two_factor_sms', 'two_factor_email'));

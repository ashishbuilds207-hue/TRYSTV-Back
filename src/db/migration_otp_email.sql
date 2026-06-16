-- Email OTP: store codes by email instead of phone
ALTER TABLE otp_store ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE otp_store ALTER COLUMN phone DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_store_email ON otp_store (email);

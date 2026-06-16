-- OTP storage for phone login/register
CREATE TABLE IF NOT EXISTS otp_store (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_store_phone ON otp_store (phone);
CREATE INDEX IF NOT EXISTS idx_otp_store_expires ON otp_store (expires_at);

const { pool } = require('../config/database')
const fs = require('fs')
const path = require('path')

/** Idempotent SQL patches applied on every server start (safe for production). */
const INLINE_PATCHES = [
    `ALTER TABLE otp_store ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
    `ALTER TABLE otp_store ALTER COLUMN phone DROP NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_otp_store_email ON otp_store (email)`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS app_icon_skin VARCHAR(50) DEFAULT 'tryst'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN DEFAULT true`,
]

const OPTIONAL_SQL_FILES = [
    'migration_v4_engagement.sql',
]

async function applyStartupPatches() {
    for (const sql of INLINE_PATCHES) {
        try {
            await pool.query(sql)
        } catch (err) {
            console.warn(`⚠ Startup patch skipped: ${err.message}`)
        }
    }

    const dbDir = path.join(__dirname)
    for (const file of OPTIONAL_SQL_FILES) {
        const filePath = path.join(dbDir, file)
        if (!fs.existsSync(filePath)) continue
        try {
            await pool.query(fs.readFileSync(filePath, 'utf8'))
            console.log(`✓ Applied ${file}`)
        } catch (err) {
            if (!/already exists/i.test(err.message)) {
                console.warn(`⚠ ${file}: ${err.message}`)
            }
        }
    }
}

module.exports = { applyStartupPatches }

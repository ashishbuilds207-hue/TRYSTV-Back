const bcrypt = require('bcryptjs')
const { query } = require('../config/database')
const { normalizeEmail } = require('../utils/email')
const { sendEmail } = require('../services/email.service')

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const isLogOnly = () => process.env.OTP_LOG_ONLY === 'true'

const storeOtp = async (email, otp) => {
    const normalized = normalizeEmail(email)
    const hash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000)
    await query('DELETE FROM otp_store WHERE email = $1', [normalized])
    await query(
        'INSERT INTO otp_store (email, otp_hash, expires_at) VALUES ($1,$2,$3)',
        [normalized, hash, expiresAt]
    )
}

const verifyOtp = async (email, otp) => {
    const normalized = normalizeEmail(email)
    const { rows } = await query(
        'SELECT * FROM otp_store WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [normalized]
    )
    if (!rows[0]) return false

    const record = rows[0]
    if (record.attempts >= 5) {
        await query('DELETE FROM otp_store WHERE id = $1', [record.id])
        return false
    }

    const match = await bcrypt.compare(otp, record.otp_hash)
    if (!match) {
        await query('UPDATE otp_store SET attempts = attempts + 1 WHERE id = $1', [record.id])
        return false
    }

    await query('DELETE FROM otp_store WHERE email = $1', [normalized])
    return true
}

/** @returns {'email'|'console'} */
const sendOtpEmail = async (email, otp) => {
    const normalized = normalizeEmail(email)

    if (isLogOnly()) {
        console.log(`[OTP] ${normalized} → ${otp}`)
        return 'console'
    }

    if (!process.env.SENDGRID_API_KEY) {
        throw new Error('Email service is not configured on the server.')
    }

    try {
        await sendEmail(normalized, 'otp', { otp })
        console.log(`[OTP] Email sent to ${normalized}`)
        return 'email'
    } catch (err) {
        console.error('[OTP] Email send failed:', err.message)
        throw new Error('Could not send verification email. Check your inbox address and try again.')
    }
}

module.exports = { generateOtp, storeOtp, verifyOtp, sendOtpEmail, normalizeEmail }

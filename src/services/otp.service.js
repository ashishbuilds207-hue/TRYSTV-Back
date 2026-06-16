const bcrypt = require('bcryptjs')
const { query } = require('../config/database')

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const storeOtp = async (phone, otp) => {
    const hash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000)
    await query('DELETE FROM otp_store WHERE phone = $1', [phone])
    await query('INSERT INTO otp_store (phone, otp_hash, expires_at) VALUES ($1,$2,$3)', [phone, hash, expiresAt])
}

const verifyOtp = async (phone, otp) => {
    const { rows } = await query(
        'SELECT * FROM otp_store WHERE phone = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [phone]
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

    await query('DELETE FROM otp_store WHERE phone = $1', [phone])
    return true
}

// Twilio send (real) — falls back to console log when Twilio is not configured
const sendOtpSms = async (phone, otp) => {
    const hasTwilio =
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER

    if (process.env.NODE_ENV === 'development' || process.env.OTP_LOG_ONLY === 'true' || !hasTwilio) {
        console.log(`[OTP] ${phone} → ${otp}`)
        return
    }

    try {
        const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
        await twilio.messages.create({
            body: `Your TRYST verification code is ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Never share this.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        })
    } catch (err) {
        console.error('[OTP] Twilio send failed:', err.message)
        console.log(`[OTP] ${phone} → ${otp}`)
    }
}

module.exports = { generateOtp, storeOtp, verifyOtp, sendOtpSms }

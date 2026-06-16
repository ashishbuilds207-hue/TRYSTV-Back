const bcrypt = require('bcryptjs')
const { query } = require('../config/database')
const { normalizePhone } = require('../utils/phone')

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const getTwilioClient = () => {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) return null
    return require('twilio')(sid, token)
}

const useTwilioVerify = () =>
  Boolean(process.env.TWILIO_VERIFY_SERVICE_SID) &&
  process.env.NODE_ENV !== 'development' &&
  process.env.OTP_LOG_ONLY !== 'true'

const storeOtp = async (phone, otp) => {
    const normalized = normalizePhone(phone)
    const hash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000)
    await query('DELETE FROM otp_store WHERE phone = $1', [normalized])
    await query('INSERT INTO otp_store (phone, otp_hash, expires_at) VALUES ($1,$2,$3)', [normalized, hash, expiresAt])
}

const verifyOtpFromDb = async (phone, otp) => {
    const normalized = normalizePhone(phone)
    const { rows } = await query(
        'SELECT * FROM otp_store WHERE phone = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
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

    await query('DELETE FROM otp_store WHERE phone = $1', [normalized])
    return true
}

const verifyOtpViaTwilio = async (phone, otp) => {
    const normalized = normalizePhone(phone)
    const client = getTwilioClient()
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
    if (!client || !serviceSid) return false

    const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({ to: normalized, code: otp })

    return check.status === 'approved'
}

const verifyOtp = async (phone, otp) => {
    if (useTwilioVerify()) {
        try {
            return await verifyOtpViaTwilio(phone, otp)
        } catch (err) {
            console.error('[OTP] Twilio Verify check failed:', err.message)
            return false
        }
    }
    return verifyOtpFromDb(phone, otp)
}

const smsErrorMessage = (err) => {
    const msg = err?.message || ''
    if (msg.includes('unverified') || msg.includes('Trial accounts')) {
        return 'SMS could not be sent. Upgrade your Twilio account from trial and enable India in Geo Permissions to send to any number.'
    }
    if (msg.includes('Permission to send an SMS has not been enabled')) {
        return 'SMS to this country is blocked. Enable the country in Twilio → Messaging → Geo Permissions.'
    }
    if (msg.includes('Cannot find module')) {
        return 'SMS service is not installed on the server. Contact support.'
    }
    return 'Could not send SMS to this number. Please check the number and try again.'
}

/** Send OTP via Twilio Verify (any number on paid account) or legacy SMS */
const sendOtpSms = async (phone, otp) => {
    const normalized = normalizePhone(phone)

    if (process.env.NODE_ENV === 'development' || process.env.OTP_LOG_ONLY === 'true') {
        console.log(`[OTP] ${normalized} → ${otp}`)
        return
    }

    const client = getTwilioClient()
    if (!client) {
        throw new Error('SMS service is not configured on the server.')
    }

    try {
        if (useTwilioVerify()) {
            await client.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verifications.create({ to: normalized, channel: 'sms' })
            console.log(`[OTP] Twilio Verify sent to ${normalized}`)
            return
        }

        if (!process.env.TWILIO_PHONE_NUMBER) {
            throw new Error('TWILIO_PHONE_NUMBER is not configured.')
        }

        await client.messages.create({
            body: `Your TRYST verification code is ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Never share this.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: normalized,
        })
        console.log(`[OTP] SMS sent to ${normalized}`)
    } catch (err) {
        console.error('[OTP] Twilio send failed:', err.message)
        throw new Error(smsErrorMessage(err))
    }
}

module.exports = { generateOtp, storeOtp, verifyOtp, sendOtpSms, normalizePhone, useTwilioVerify }

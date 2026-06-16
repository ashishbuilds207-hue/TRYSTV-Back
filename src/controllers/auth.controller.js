const { OAuth2Client } = require('google-auth-library')
const UserModel = require('../models/user.model')
const { generateOtp, storeOtp, verifyOtp, sendOtpEmail, normalizeEmail } = require('../services/otp.service')
const { sendEmail } = require('../services/email.service')
const { generateTokens, verifyRefresh } = require('../utils/jwt')
const { success, error } = require('../utils/response')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const sendOtp = async (req, res) => {
    try {
        const { email } = req.body
        const normalized = normalizeEmail(email)
        const otp = generateOtp()
        await storeOtp(normalized, otp)
        const otpMode = await sendOtpEmail(normalized, otp)
        success(res, { otpMode }, 'OTP sent to your email')
    } catch (err) {
        console.error('[sendOtp]', err)
        const msg = err.message || 'Could not send OTP. Please try again.'
        const isSchema = /column|relation|does not exist/i.test(msg)
        const isEmail = /email/i.test(msg)
        const status = isSchema ? 503 : isEmail ? 503 : 500
        error(res, isSchema ? 'Server database needs update. Contact support or retry shortly.' : msg, status)
    }
}

const verifyOtpLogin = async (req, res) => {
    try {
        const { email, otp } = req.body
        const normalized = normalizeEmail(email)
        const valid = await verifyOtp(normalized, otp)
        if (!valid) return error(res, 'Invalid or expired OTP', 400)

        let user = await UserModel.findByEmail(normalized)

        if (!user) {
            return success(res, { isNew: true, email: normalized }, 'OTP verified. Complete registration.')
        }

        await UserModel.updateLastSeen(user.id)
        const { accessToken, refreshToken } = generateTokens({ id: user.id, alias: user.alias })
        success(res, { accessToken, refreshToken, user: sanitize(user), isNew: false })
    } catch (err) {
        console.error('[verifyOtpLogin]', err)
        error(res, 'Could not verify OTP. Please try again.', 500)
    }
}

const register = async (req, res) => {
    try {
        const { email, alias, age, gender, relationshipStatus, desireTags, profession, city, country, googleId, avatarUrl } = req.body
        const normalized = normalizeEmail(email)

        if (googleId) {
            const existingGoogle = await UserModel.findByGoogleId(googleId)
            if (existingGoogle) return error(res, 'Google account already registered', 409)
        }

        const existing = await UserModel.findByEmail(normalized)
        if (existing) return error(res, 'Email already registered', 409)

        const user = await UserModel.create({
            email: normalized, alias, age, gender, relationshipStatus, desireTags, profession, city, country,
            googleId: googleId || null, avatarUrl: avatarUrl || null,
        })
        try {
            await sendEmail(normalized, 'welcome', { alias: user.alias })
        } catch (emailErr) {
            console.warn('[register] welcome email skipped:', emailErr.message)
        }

        const { accessToken, refreshToken } = generateTokens({ id: user.id, alias: user.alias })
        success(res, { accessToken, refreshToken, user: sanitize(user) }, 'Account created', 201)
    } catch (err) {
        console.error('[register]', err)
        error(res, 'Registration failed. Please try again.', 500)
    }
}

const googleLogin = async (req, res) => {
    const { idToken } = req.body
    let payload
    try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
        payload = ticket.getPayload()
    } catch {
        return error(res, 'Invalid Google token', 401)
    }
    return handleGoogleUser(res, payload.sub, payload.email, payload.name, payload.picture)
}

const googleAccessLogin = async (req, res) => {
    const { accessToken, googleId, email, name, avatar } = req.body
    if (!accessToken || !googleId || !email) return error(res, 'Missing Google credentials', 400)

    try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!r.ok) return error(res, 'Invalid Google access token', 401)
        const info = await r.json()
        if (info.sub !== googleId) return error(res, 'Token mismatch', 401)
    } catch {
        return error(res, 'Could not verify Google token', 401)
    }

    return handleGoogleUser(res, googleId, email, name, avatar)
}

async function handleGoogleUser(res, googleId, email, name, avatar) {
    let user = await UserModel.findByGoogleId(googleId)
    if (!user) user = await UserModel.findByEmail(email)

    if (!user) {
        return success(res, { isNew: true, googleId, email, name, avatar }, 'Google verified. Complete registration.')
    }

    UserModel.updateLastSeen(user.id)
    const { accessToken, refreshToken } = generateTokens({ id: user.id, alias: user.alias })
    success(res, { accessToken, refreshToken, user: sanitize(user), isNew: false })
}

const refreshToken = async (req, res) => {
    const { refreshToken: token } = req.body
    if (!token) return error(res, 'No refresh token', 400)
    try {
        const decoded = verifyRefresh(token)
        const user = await UserModel.findById(decoded.id)
        if (!user || !user.is_active) return error(res, 'User not found', 401)
        const tokens = generateTokens({ id: user.id, alias: user.alias })
        success(res, tokens)
    } catch {
        error(res, 'Invalid refresh token', 401)
    }
}

const getMe = async (req, res) => {
    const user = await UserModel.findById(req.user.id)
    success(res, { user: sanitize(user) })
}

const sanitize = (u) => ({
    id: u.id, alias: u.alias, age: u.age, gender: u.gender, city: u.city, country: u.country,
    bio: u.bio, desireTags: u.desire_tags, relationshipStatus: u.relationship_status, profession: u.profession,
    avatarUrl: u.avatar_url, photoUrls: u.photo_urls || [], isVerified: u.is_verified, isGold: u.is_gold,
    isObsidian: u.is_obsidian, credits: u.credits, matchScore: u.match_score, isGhostMode: u.is_ghost_mode,
    desireArchetype: u.desire_archetype, disguiseModeEnabled: u.disguise_mode_enabled,
    activeDisguiseSkin: u.active_disguise_skin, isNightMode: u.is_night_mode,
    desireStreakCount: u.desire_streak_count, seeking: u.seeking, agePrefMin: u.age_pref_min,
    agePrefMax: u.age_pref_max, maxDistanceKm: u.max_distance_km, createdAt: u.created_at,
})

module.exports = { sendOtp, verifyOtpLogin, register, googleLogin, googleAccessLogin, refreshToken, getMe }

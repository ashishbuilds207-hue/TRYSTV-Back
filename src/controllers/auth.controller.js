const { OAuth2Client } = require('google-auth-library')
const UserModel = require('../models/user.model')
const { generateOtp, storeOtp, verifyOtp, sendOtpSms } = require('../services/otp.service')
const { sendEmail } = require('../services/email.service')
const { generateTokens, verifyRefresh } = require('../utils/jwt')
const { success, error } = require('../utils/response')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const sendOtp = async (req, res) => {
    const { phone } = req.body
    const otp = generateOtp()
    await storeOtp(phone, otp)
    await sendOtpSms(phone, otp)

    // Dev / staging: return OTP in API response for testing
    const showDevOtp =
        process.env.NODE_ENV === 'development' || process.env.OTP_RETURN_DEV === 'true'
    const devPayload = showDevOtp ? { devOtp: otp } : {}
    success(res, devPayload, 'OTP sent successfully')
}

const verifyOtpLogin = async (req, res) => {
    const { phone, otp } = req.body
    const valid = await verifyOtp(phone, otp)
    if (!valid) return error(res, 'Invalid or expired OTP', 400)

    let user = await UserModel.findByPhone(phone)
    const isNew = !user

    if (!user) {
        return success(res, { isNew: true, phone }, 'OTP verified. Complete registration.')
    }

    UserModel.updateLastSeen(user.id)
    const { accessToken, refreshToken } = generateTokens({ id: user.id, alias: user.alias })
    success(res, { accessToken, refreshToken, user: sanitize(user), isNew: false })
}

const register = async (req, res) => {
    const { phone, alias, age, gender, relationshipStatus, desireTags, profession, city, country } = req.body

    const existing = await UserModel.findByPhone(phone)
    if (existing) return error(res, 'Phone already registered', 409)

    const user = await UserModel.create({ phone, alias, age, gender, relationshipStatus, desireTags, profession, city, country })
    await sendEmail(null, 'welcome', { alias })

    const { accessToken, refreshToken } = generateTokens({ id: user.id, alias: user.alias })
    success(res, { accessToken, refreshToken, user: sanitize(user) }, 'Account created', 201)
}

// Legacy: ID token flow (for server-side verification)
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

// Access token flow (frontend sends access_token from @react-oauth/google)
const googleAccessLogin = async (req, res) => {
    const { accessToken, googleId, email, name, avatar } = req.body
    if (!accessToken || !googleId || !email) return error(res, 'Missing Google credentials', 400)

    // Verify the token is legit by calling Google userinfo
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

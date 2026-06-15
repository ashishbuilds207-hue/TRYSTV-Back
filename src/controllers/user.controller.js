const path = require('path')
const fs = require('fs')
const UserModel = require('../models/user.model')
const { success, error } = require('../utils/response')
const { calcProfileCompletion } = require('../utils/profileCompletion')
const { getDailyLikeStatus } = require('../utils/dailyLikes')

const FIELD_MAP = {
    desireTags: 'desire_tags',
    relationshipStatus: 'relationship_status',
    avatarUrl: 'avatar_url',
    photoUrls: 'photo_urls',
    isGhostMode: 'is_ghost_mode',
    desireArchetype: 'desire_archetype',
    availabilityMask: 'availability_mask',
    blurDefault: 'blur_default',
    incognitoOnStart: 'incognito_on_start',
    showExactDistance: 'show_exact_distance',
    callsEnabled: 'calls_enabled',
    videoCallsEnabled: 'video_calls_enabled',
    socialInterests: 'social_interests',
    disguiseModeEnabled: 'disguise_mode_enabled',
    activeDisguiseSkin: 'active_disguise_skin',
    isNightMode: 'is_night_mode',
    heightCm: 'height_cm',
    agePrefMin: 'age_pref_min',
    agePrefMax: 'age_pref_max',
    maxDistanceKm: 'max_distance_km',
    latitude: 'latitude',
    longitude: 'longitude',
}

const getDiscover = async (req, res) => {
    const { page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit
    const profiles = await UserModel.getDiscover(req.user.id, parseInt(limit), parseInt(offset))
    success(res, { profiles: profiles.map(safeProfile) })
}

const getProfile = async (req, res) => {
    const user = await UserModel.findById(req.params.id || req.user.id)
    if (!user) return error(res, 'User not found', 404)
    success(res, { user: safeProfile(user) })
}

const GENDER_ALIASES = {
    'non-binary': 'other',
    nonbinary: 'other',
    nb: 'other',
}
const ALLOWED_GENDERS = new Set(['male', 'female', 'other'])

const normalizeGender = (val) => {
    if (val === undefined || val === null || val === '') return undefined
    const normalized = String(val).trim().toLowerCase()
    const mapped = GENDER_ALIASES[normalized] || normalized
    if (!ALLOWED_GENDERS.has(mapped)) {
        throw Object.assign(new Error(`Gender must be male, female, or other`), { statusCode: 400 })
    }
    return mapped
}

const updateProfile = async (req, res) => {
    const data = {}
    for (const [key, val] of Object.entries(req.body)) {
        if (val === undefined || val === null || val === '') continue
        const dbKey = FIELD_MAP[key] || key
        if (dbKey === 'gender') {
            const gender = normalizeGender(val)
            if (gender) data[dbKey] = gender
            continue
        }
        data[dbKey] = val
    }
    try {
        const user = await UserModel.update(req.user.id, data)
        if (!user) return error(res, 'Nothing updated', 400)
        success(res, { user: safeProfile(user) })
    } catch (err) {
        if (err.statusCode) return error(res, err.message, err.statusCode)
        throw err
    }
}

const toggleGhostMode = async (req, res) => {
    const current = await UserModel.findById(req.user.id)
    const updated = await UserModel.update(req.user.id, { is_ghost_mode: !current.is_ghost_mode })
    success(res, { isGhostMode: updated.is_ghost_mode })
}

const toggleDisguise = async (req, res) => {
    const current = await UserModel.findById(req.user.id)
    const enabled = !current.disguise_mode_enabled
    const updated = await UserModel.update(req.user.id, {
        disguise_mode_enabled: enabled,
        active_disguise_skin: req.body.skin || current.active_disguise_skin || 'newspaper',
    })
    success(res, {
        disguiseModeEnabled: updated.disguise_mode_enabled,
        activeDisguiseSkin: updated.active_disguise_skin,
    })
}

const getNotifications = async (req, res) => {
    const NotificationModel = require('../models/notification.model')
    const notifications = await NotificationModel.getByUser(req.user.id)
    success(res, { notifications })
}

const markNotificationRead = async (req, res) => {
    const NotificationModel = require('../models/notification.model')
    await NotificationModel.markRead(req.params.id, req.user.id)
    success(res, {}, 'Marked as read')
}

const getProfileCompletion = async (req, res) => {
    const user = await UserModel.findById(req.user.id)
    if (!user) return error(res, 'User not found', 404)
    const completion = calcProfileCompletion(user)
    const likes = await getDailyLikeStatus(user)
    success(res, { completion, dailyLikes: likes })
}

const uploadPhotos = async (req, res) => {
    const user = await UserModel.findById(req.user.id)
    if (!user) return error(res, 'User not found', 404)

    const files = req.files || []
    if (!files.length) return error(res, 'No images uploaded', 400)

    const current = user.photo_urls || []
    if (current.length + files.length > 6) {
        return error(res, 'Maximum 6 photos allowed', 400)
    }

    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`
    const newUrls = files.map(f => `${baseUrl}/uploads/photos/${f.filename}`)
    const photoUrls = [...current, ...newUrls].slice(0, 6)
    const avatarUrl = user.avatar_url || photoUrls[0]

    const updated = await UserModel.update(req.user.id, {
        photo_urls: photoUrls,
        avatar_url: avatarUrl,
    })

    success(res, {
        user: safeProfile(updated),
        completion: calcProfileCompletion(updated),
    }, 'Photos uploaded')
}

const deletePhoto = async (req, res) => {
    const index = parseInt(req.params.index, 10)
    const user = await UserModel.findById(req.user.id)
    if (!user) return error(res, 'User not found', 404)

    const photos = [...(user.photo_urls || [])]
    if (index < 0 || index >= photos.length) return error(res, 'Photo not found', 404)

    const removed = photos.splice(index, 1)[0]
    try {
        const filename = removed.split('/').pop()
        const filePath = path.join(__dirname, '../../uploads/photos', filename)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { /* ignore */ }

    const avatarUrl = photos[0] || null
    const updated = await UserModel.update(req.user.id, {
        photo_urls: photos,
        avatar_url: avatarUrl,
    })

    success(res, { user: safeProfile(updated), completion: calcProfileCompletion(updated) })
}

const setAvatarPhoto = async (req, res) => {
    const index = parseInt(req.params.index, 10)
    const user = await UserModel.findById(req.user.id)
    const photos = user?.photo_urls || []
    if (index < 0 || index >= photos.length) return error(res, 'Photo not found', 404)

    const updated = await UserModel.update(req.user.id, { avatar_url: photos[index] })
    success(res, { user: safeProfile(updated) })
}

const getDailyLikes = async (req, res) => {
    const user = await UserModel.findById(req.user.id)
    const likes = await getDailyLikeStatus(user)
    success(res, { dailyLikes: likes })
}

const safeProfile = (u) => {
    const completion = calcProfileCompletion(u)
    return {
    id: u.id, alias: u.alias, age: u.age, city: u.city, country: u.country, bio: u.bio,
    desireTags: u.desire_tags, relationshipStatus: u.relationship_status, profession: u.profession,
    photoUrls: u.photo_urls || [], avatarUrl: u.avatar_url, isVerified: u.is_verified,
    isOnline: u.last_seen && new Date(u.last_seen) > new Date(Date.now() - 5 * 60 * 1000),
    lastSeen: u.last_seen, matchScore: u.match_score, gender: u.gender,
    desireArchetype: u.desire_archetype, availabilityMask: u.availability_mask,
    blurDefault: u.blur_default, incognitoOnStart: u.incognito_on_start,
    showExactDistance: u.show_exact_distance, callsEnabled: u.calls_enabled,
    videoCallsEnabled: u.video_calls_enabled, desireStreakCount: u.desire_streak_count,
    socialVerified: u.social_verified, socialInterests: u.social_interests || [],
    disguiseModeEnabled: u.disguise_mode_enabled, activeDisguiseSkin: u.active_disguise_skin,
    isNightMode: u.is_night_mode, heightCm: u.height_cm, build: u.build,
    orientation: u.orientation, seeking: u.seeking, agePrefMin: u.age_pref_min,
    agePrefMax: u.age_pref_max, maxDistanceKm: u.max_distance_km,
    isGold: u.is_gold, isObsidian: u.is_obsidian, isGhostMode: u.is_ghost_mode,
    profileCompletion: completion.percent,
    photoCount: completion.photoCount,
    }
}

module.exports = {
    getDiscover, getProfile, updateProfile, toggleGhostMode,
    toggleDisguise, getNotifications, markNotificationRead,
    uploadPhotos, deletePhoto, setAvatarPhoto, getProfileCompletion, getDailyLikes,
}

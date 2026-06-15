const MatchModel = require('../models/match.model')
const NotificationModel = require('../models/notification.model')
const UserModel = require('../models/user.model')
const { query } = require('../config/database')
const { success, error } = require('../utils/response')

const mapProfile = (u) => ({
    id: u.id, alias: u.alias, age: u.age, city: u.city, country: u.country, bio: u.bio,
    desireTags: u.desire_tags, profession: u.profession, photoUrls: u.photo_urls || [],
    avatarUrl: u.avatar_url, isVerified: u.is_verified, matchScore: u.match_score, gender: u.gender,
    desireArchetype: u.desire_archetype, build: u.build, orientation: u.orientation, ring: u.ring,
    isOnline: u.last_seen && new Date(u.last_seen) > new Date(Date.now() - 5 * 60 * 1000),
})

const { consumeDailyLike } = require('../utils/dailyLikes')

const getOrbitFeed = async (req, res) => {
    const userId = req.user.id
    try {
        const { rows } = await query(`
            WITH me AS (
                SELECT seeking, age_pref_min, age_pref_max, city, country, max_distance_km
                FROM users WHERE id = $1
            )
            SELECT
                u.id, u.alias, u.age, u.city, u.country, u.bio,
                u.desire_tags, u.profession, u.photo_urls, u.avatar_url,
                u.is_verified, u.last_seen, u.match_score, u.gender,
                u.desire_archetype, u.build, u.orientation,
                CASE
                    WHEN u.match_score >= 80 THEN 1
                    WHEN u.match_score >= 60 THEN 2
                    ELSE 3
                END AS ring
            FROM users u, me
            WHERE u.id != $1
              AND u.is_active = true
              AND u.is_ghost_mode = false
              AND u.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1)
              AND u.age BETWEEN COALESCE(me.age_pref_min, 18) AND COALESCE(me.age_pref_max, 99)
              AND (
                me.seeking IS NULL OR me.seeking = '' OR me.seeking = 'Everyone'
                OR (me.seeking IN ('Women', 'Woman') AND u.gender = 'female')
                OR (me.seeking IN ('Men', 'Man') AND u.gender = 'male')
                OR (me.seeking = 'Other' AND u.gender = 'other')
              )
              AND (
                COALESCE(me.max_distance_km, 50) >= 100
                OR me.city IS NULL OR me.city = ''
                OR u.city = me.city
                OR (me.country IS NOT NULL AND u.country = me.country)
              )
            ORDER BY CASE WHEN u.city = me.city THEN 0 ELSE 1 END, u.match_score DESC NULLS LAST
            LIMIT 20
        `, [userId])
        success(res, { profiles: rows.map(mapProfile) })
    } catch {
        error(res, 'Failed to load orbit feed', 500)
    }
}

const ensureLikeAllowed = async (userId) => {
    const status = await consumeDailyLike(userId)
    if (!status.allowed) {
        const err = Object.assign(new Error('Daily like limit reached. Upgrade to Gold.'), {
            statusCode: 402,
            data: { code: 'DAILY_LIMIT', remaining: 0, limit: status.limit },
        })
        throw err
    }
    return status
}

const recordPull = async (req, res) => {
    const userId = req.user.id
    const { targetId } = req.body
    if (!targetId) return error(res, 'targetId required', 400)

    try {
        const likeStatus = await ensureLikeAllowed(userId)
        await MatchModel.createSwipe(userId, targetId, 'like')

        const isMutual = await MatchModel.checkMutualLike(userId, targetId)
        if (isMutual) {
            const [a, b] = [userId, targetId].sort()
            const { rows: existing } = await query(
                'SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2',
                [a, b]
            )
            if (!existing.length) {
                await query(
                    `INSERT INTO matches (user1_id, user2_id, interaction_type) VALUES ($1, $2, 'SIMMER')`,
                    [a, b]
                )
            }
            return success(res, { simmer: true, remaining: likeStatus.remaining }, 'A Simmer has ignited between you two')
        }
        success(res, { simmer: false, remaining: likeStatus.remaining }, 'Interest noted')
    } catch (err) {
        if (err.statusCode) return error(res, err.message, err.statusCode, err.data)
        error(res, 'Failed to record pull', 500)
    }
}

const recordIgnite = async (req, res) => {
    const userId = req.user.id
    const { targetId } = req.body
    if (!targetId) return error(res, 'targetId required', 400)

    try {
        const likeStatus = await ensureLikeAllowed(userId)
        await MatchModel.createSwipe(userId, targetId, 'super')

        const isMutual = await MatchModel.checkMutualLike(userId, targetId)
        let matched = false

        if (isMutual) {
            const match = await MatchModel.createMatch(userId, targetId, true)
            await query(`UPDATE matches SET interaction_type = 'MATCH' WHERE id = $1`, [match.id])

            const partner = await UserModel.findById(targetId)
            const me = await UserModel.findById(userId)
            await NotificationModel.create(
                targetId, 'match', "It's a TRYST!",
                `You matched with ${me.alias}`, { matchId: match.id }
            )

            matched = true
            return success(res, {
                matched: true,
                matchId: match.id,
                partner: { alias: partner.alias, avatarUrl: partner.avatar_url },
                remaining: likeStatus.remaining,
            }, "It's a TRYST!")
        }

        success(res, { matched, remaining: likeStatus.remaining }, matched ? "It's a TRYST!" : 'Spark sent')
    } catch (err) {
        if (err.statusCode) return error(res, err.message, err.statusCode, err.data)
        error(res, 'Failed to record ignite', 500)
    }
}

const recordPass = async (req, res) => {
    const userId = req.user.id
    const { targetId } = req.body
    if (!targetId) return error(res, 'targetId required', 400)
    try {
        await MatchModel.createSwipe(userId, targetId, 'pass')
        success(res, {}, 'Passed')
    } catch {
        error(res, 'Failed to record pass', 500)
    }
}

module.exports = { getOrbitFeed, recordPull, recordIgnite, recordPass }

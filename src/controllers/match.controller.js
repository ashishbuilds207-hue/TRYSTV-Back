const MatchModel = require('../models/match.model')
const NotificationModel = require('../models/notification.model')
const UserModel = require('../models/user.model')
const { query } = require('../config/database')
const { success, error } = require('../utils/response')
const { getIo } = require('../sockets')
const { consumeDailyLike } = require('../utils/dailyLikes')

const swipe = async (req, res) => {
    const { targetId, direction } = req.body
    const userId = req.user.id

    if (userId === targetId) return error(res, 'Cannot swipe yourself', 400)

    if (direction === 'like' || direction === 'super') {
        const likeStatus = await consumeDailyLike(userId)
        if (!likeStatus.allowed) {
            return error(res, 'Daily like limit reached. Upgrade to Gold for unlimited likes.', 402, {
                code: 'DAILY_LIMIT',
                remaining: 0,
                limit: likeStatus.limit,
            })
        }
    }

    await MatchModel.createSwipe(userId, targetId, direction)

    let match = null
    let isSpark = false

    if (direction === 'like' || direction === 'super') {
        const isMutual = await MatchModel.checkMutualLike(userId, targetId)
        if (isMutual) {
            isSpark = direction === 'super'
            match = await MatchModel.createMatch(userId, targetId, isSpark)

            // Notify both
            const [u1, u2] = await Promise.all([UserModel.findById(userId), UserModel.findById(targetId)])
            await Promise.all([
                NotificationModel.create(targetId, 'spark', `New Spark!`, `You matched with ${u1.alias}`, { matchId: match.id }),
                NotificationModel.create(userId, 'spark', `New Spark!`, `You matched with ${u2.alias}`, { matchId: match.id }),
            ])

            const io = getIo()
            if (io) {
                io.to(targetId).emit('new_match', { matchId: match.id, partner: { alias: u1.alias, avatarUrl: u1.avatar_url } })
                io.to(userId).emit('new_match', { matchId: match.id, partner: { alias: u2.alias, avatarUrl: u2.avatar_url } })
            }
        }
    }

    success(res, { matched: !!match, isSpark, matchId: match?.id })
}

const getMatches = async (req, res) => {
    const matches = await MatchModel.getUserMatches(req.user.id)
    success(res, { matches })
}

const getMatch = async (req, res) => {
    const match = await MatchModel.getMatchById(req.params.id, req.user.id)
    if (!match) return error(res, 'Match not found', 404)
    success(res, { match })
}

const setCallConsent = async (req, res) => {
    const { matchId } = req.params
    const userId = req.user.id
    const match = await MatchModel.getMatchById(matchId, userId)
    if (!match) return error(res, 'Match not found', 404)

    const isUser1 = match.user1_id === userId
    const col = isUser1 ? 'user_a_calls_consent' : 'user_b_calls_consent'
    await query(`UPDATE matches SET ${col} = true WHERE id = $1`, [matchId])

    const { rows } = await query('SELECT user_a_calls_consent, user_b_calls_consent FROM matches WHERE id = $1', [matchId])
    const updated = rows[0]
    const myConsent = true
    const partnerConsent = isUser1 ? updated.user_b_calls_consent : updated.user_a_calls_consent

    success(res, {
        myConsent,
        partnerConsent,
        canCall: updated.user_a_calls_consent && updated.user_b_calls_consent,
    })
}

const getCallConsent = async (req, res) => {
    const { matchId } = req.params
    const userId = req.user.id
    const match = await MatchModel.getMatchById(matchId, userId)
    if (!match) return error(res, 'Match not found', 404)

    const isUser1 = match.user1_id === userId
    success(res, {
        myConsent: isUser1 ? match.user_a_calls_consent : match.user_b_calls_consent,
        partnerConsent: isUser1 ? match.user_b_calls_consent : match.user_a_calls_consent,
        canCall: match.user_a_calls_consent && match.user_b_calls_consent,
    })
}

module.exports = { swipe, getMatches, getMatch, setCallConsent, getCallConsent }

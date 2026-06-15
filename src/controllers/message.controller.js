const MessageModel = require('../models/message.model')
const MatchModel = require('../models/match.model')
const UserModel = require('../models/user.model')
const { success, error } = require('../utils/response')
const { getIo } = require('../sockets')

const getMessages = async (req, res) => {
    const match = await MatchModel.getMatchById(req.params.matchId, req.user.id)
    if (!match) return error(res, 'Match not found', 404)

    const messages = await MessageModel.getByConversation(match.conv_id, 50, req.query.before)
    await MessageModel.markRead(match.conv_id, req.user.id)
    success(res, { messages, convId: match.conv_id, deleteTimer: match.delete_timer })
}

const sendMessage = async (req, res) => {
    const { matchId } = req.params
    const { content, type = 'text' } = req.body
    const userId = req.user.id

    const match = await MatchModel.getMatchById(matchId, userId)
    if (!match) return error(res, 'Match not found', 404)

    // Male non-gold users spend credits
    const sender = await UserModel.findById(userId)
    if (sender.gender === 'male' && !sender.is_gold) {
        const updated = await UserModel.spendCredits(userId, 1)
        if (!updated) return error(res, 'Insufficient credits. Purchase more to continue.', 402)
    }

    // Set expiry based on delete timer
    let expiresAt = null
    const timerMap = { '24h': 24 * 3600, '72h': 72 * 3600, '7d': 7 * 24 * 3600 }
    if (match.delete_timer && timerMap[match.delete_timer]) {
        expiresAt = new Date(Date.now() + timerMap[match.delete_timer] * 1000)
    }

    const message = await MessageModel.create(match.conv_id, userId, content, type, expiresAt)

    const io = getIo()
    if (io) {
        const partnerId = match.user1_id === userId ? match.user2_id : match.user1_id
        io.to(partnerId).emit('new_message', { matchId, message })
        io.to(userId).emit('new_message', { matchId, message })
    }

    success(res, { message }, 'Message sent', 201)
}

const deleteMessage = async (req, res) => {
    await MessageModel.softDelete(req.params.id, req.user.id)
    success(res, {}, 'Message deleted')
}

module.exports = { getMessages, sendMessage, deleteMessage }

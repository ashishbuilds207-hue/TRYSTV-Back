const { verifyAccess } = require('../utils/jwt')
const { query } = require('../config/database')
const MessageModel = require('../models/message.model')
const MatchModel = require('../models/match.model')

let io = null

const initSockets = (socketIo) => {
    io = socketIo

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token
            if (!token) return next(new Error('No token'))
            const decoded = verifyAccess(token)
            const { rows } = await query('SELECT id, alias FROM users WHERE id = $1 AND is_active = true', [decoded.id])
            if (!rows[0]) return next(new Error('User not found'))
            socket.user = rows[0]
            next()
        } catch {
            next(new Error('Auth failed'))
        }
    })

    io.on('connection', (socket) => {
        const userId = socket.user.id
        socket.join(userId)
        query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId])
        console.log(`Socket: ${socket.user.alias} connected`)

        socket.on('join_chat', async (matchId) => {
            const match = await MatchModel.getMatchById(matchId, userId)
            if (match) {
                socket.join(`chat:${matchId}`)
                await MessageModel.markRead(match.conv_id, userId)
                io.to(userId).emit('messages_read', { matchId })
            }
        })

        socket.on('leave_chat', (matchId) => {
            socket.leave(`chat:${matchId}`)
        })

        socket.on('typing', ({ matchId, isTyping }) => {
            socket.to(`chat:${matchId}`).emit('partner_typing', { userId, isTyping })
        })

        socket.on('send_message', async ({ matchId, content, type = 'text' }) => {
            try {
                const match = await MatchModel.getMatchById(matchId, userId)
                if (!match) return

                let expiresAt = null
                const timerMap = { '24h': 24, '72h': 72, '7d': 168 }
                if (match.delete_timer && timerMap[match.delete_timer]) {
                    expiresAt = new Date(Date.now() + timerMap[match.delete_timer] * 3600 * 1000)
                }

                const message = await MessageModel.create(match.conv_id, userId, content, type, expiresAt)
                io.to(`chat:${matchId}`).emit('new_message', { matchId, message: { ...message, sender_alias: socket.user.alias } })
            } catch (e) {
                socket.emit('error', { message: 'Failed to send message' })
            }
        })

        socket.on('disconnect', () => {
            query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId])
            console.log(`Socket: ${socket.user.alias} disconnected`)
        })
    })
}

const getIo = () => io

module.exports = { initSockets, getIo }

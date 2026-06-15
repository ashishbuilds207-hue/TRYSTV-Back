const { query } = require('../config/database')

const NotificationModel = {
    create: async (userId, type, title, body, data = {}) => {
        const { rows } = await query(`
            INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [userId, type, title, body, data])
        return rows[0]
    },

    getByUser: async (userId, limit = 30) => {
        const { rows } = await query(`
            SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
        `, [userId, limit])
        return rows
    },

    markRead: (id, userId) => query(`
        UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2
    `, [id, userId]),

    markAllRead: (userId) => query(`
        UPDATE notifications SET is_read = true WHERE user_id = $1
    `, [userId]),

    unreadCount: async (userId) => {
        const { rows } = await query(`SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`, [userId])
        return parseInt(rows[0].count)
    },
}

module.exports = NotificationModel

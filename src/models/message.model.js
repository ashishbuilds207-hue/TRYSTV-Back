const { query } = require('../config/database')

const MessageModel = {
    getByConversation: async (convId, limit = 50, before = null) => {
        const params = [convId, limit]
        let whereBefore = ''
        if (before) { params.push(before); whereBefore = `AND created_at < $${params.length}` }
        const { rows } = await query(`
            SELECT m.id, m.sender_id, m.content, m.type, m.is_read, m.is_deleted, m.expires_at, m.created_at,
                   u.alias as sender_alias, u.avatar_url as sender_avatar
            FROM messages m JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = $1 AND m.is_deleted = false ${whereBefore}
            ORDER BY m.created_at ASC
            LIMIT $2
        `, params)
        return rows
    },

    create: async (convId, senderId, content, type = 'text', expiresAt = null) => {
        const { rows } = await query(`
            INSERT INTO messages (conversation_id, sender_id, content, type, expires_at)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [convId, senderId, content, type, expiresAt])
        return rows[0]
    },

    markRead: (convId, userId) => query(`
        UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [convId, userId]),

    softDelete: (id, userId) => query(`
        UPDATE messages SET is_deleted = true WHERE id = $1 AND sender_id = $2
    `, [id, userId]),

    deleteExpired: () => query(`
        UPDATE messages SET is_deleted = true WHERE expires_at < NOW() AND is_deleted = false
    `),
}

module.exports = MessageModel

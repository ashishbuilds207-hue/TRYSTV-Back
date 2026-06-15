const { query } = require('../config/database')

const MatchModel = {
    createSwipe: async (swiperId, swipedId, direction) => {
        const { rows } = await query(`
            INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES ($1,$2,$3)
            ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET direction = $3
            RETURNING *
        `, [swiperId, swipedId, direction])
        return rows[0]
    },

    checkMutualLike: async (user1, user2) => {
        const { rows } = await query(`
            SELECT id FROM swipes
            WHERE swiper_id = $1 AND swiped_id = $2 AND direction IN ('like', 'super')
        `, [user2, user1])
        return rows.length > 0
    },

    createMatch: async (user1Id, user2Id, isSpark = false) => {
        const [a, b] = [user1Id, user2Id].sort()
        const { rows } = await query(`
            INSERT INTO matches (user1_id, user2_id, is_spark) VALUES ($1,$2,$3)
            ON CONFLICT (user1_id, user2_id) DO UPDATE SET is_spark = $3
            RETURNING *
        `, [a, b, isSpark])
        const match = rows[0]

        // Create conversation
        await query(`
            INSERT INTO conversations (match_id) VALUES ($1)
            ON CONFLICT DO NOTHING
        `, [match.id])

        return match
    },

    getUserMatches: async (userId) => {
        const { rows } = await query(`
            SELECT m.id, m.is_spark, m.created_at,
                   u.id as partner_id, u.alias, u.avatar_url, u.photo_urls, u.age, u.city, u.is_verified, u.desire_tags, u.last_seen,
                   c.id as conv_id, c.delete_timer,
                   (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                   (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
                   (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false) as unread_count
            FROM matches m
            JOIN conversations c ON c.match_id = m.id
            JOIN users u ON (CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END) = u.id
            WHERE (m.user1_id = $1 OR m.user2_id = $1) AND m.is_active = true
            ORDER BY last_message_at DESC NULLS LAST
        `, [userId])
        return rows
    },

    getMatchById: async (matchId, userId) => {
        const { rows } = await query(`
            SELECT m.*, c.id as conv_id, c.delete_timer
            FROM matches m JOIN conversations c ON c.match_id = m.id
            WHERE m.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2)
        `, [matchId, userId])
        return rows[0] || null
    },
}

module.exports = MatchModel

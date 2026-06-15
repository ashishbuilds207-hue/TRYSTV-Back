const { query } = require('../config/database')

const UserModel = {
    findById: async (id) => {
        const { rows } = await query('SELECT * FROM users WHERE id = $1', [id])
        return rows[0] || null
    },

    findByPhone: async (phone) => {
        const { rows } = await query('SELECT * FROM users WHERE phone = $1', [phone])
        return rows[0] || null
    },

    findByEmail: async (email) => {
        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
        return rows[0] || null
    },

    findByGoogleId: async (googleId) => {
        const { rows } = await query('SELECT * FROM users WHERE google_id = $1', [googleId])
        return rows[0] || null
    },

    create: async (data) => {
        const { rows } = await query(`
            INSERT INTO users (alias, phone, email, google_id, age, gender, relationship_status, profession, city, country, bio, desire_tags, avatar_url, photo_urls)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING *
        `, [data.alias, data.phone || null, data.email || null, data.googleId || null, data.age, data.gender, data.relationshipStatus, data.profession || null, data.city || null, data.country || 'India', data.bio || null, data.desireTags || [], data.avatarUrl || null, data.photoUrls || []])
        return rows[0]
    },

    update: async (id, data) => {
        const fields = []
        const values = []
        let idx = 1
        const allowed = [
            'alias', 'bio', 'profession', 'city', 'country', 'desire_tags', 'relationship_status',
            'avatar_url', 'photo_urls', 'is_ghost_mode', 'last_seen', 'desire_archetype',
            'availability_mask', 'blur_default', 'incognito_on_start', 'show_exact_distance',
            'calls_enabled', 'video_calls_enabled', 'social_interests', 'disguise_mode_enabled',
            'active_disguise_skin', 'is_night_mode', 'height_cm', 'build', 'orientation',
            'seeking', 'age_pref_min', 'age_pref_max', 'max_distance_km',
            'age', 'gender', 'latitude', 'longitude',
        ]
        for (const [key, val] of Object.entries(data)) {
            if (allowed.includes(key)) {
                fields.push(`${key} = $${idx++}`)
                values.push(val)
            }
        }
        if (!fields.length) return null
        values.push(id)
        const { rows } = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values)
        return rows[0]
    },

    getDiscover: async (userId, limit = 20, offset = 0) => {
        const { rows } = await query(`
            WITH me AS (
                SELECT seeking, age_pref_min, age_pref_max, city, country, max_distance_km, gender
                FROM users WHERE id = $1
            )
            SELECT u.id, u.alias, u.age, u.city, u.country, u.bio, u.desire_tags, u.relationship_status,
                   u.profession, u.photo_urls, u.avatar_url, u.is_verified, u.last_seen, u.match_score, u.gender,
                   u.desire_archetype, u.latitude, u.longitude
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
                OR (me.country IS NOT NULL AND u.country = me.country AND COALESCE(me.max_distance_km, 50) >= 50)
              )
            ORDER BY
              CASE WHEN u.city = me.city THEN 0 ELSE 1 END,
              u.match_score DESC NULLS LAST,
              u.last_seen DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset])
        return rows
    },

    updateLastSeen: (id) => query('UPDATE users SET last_seen = NOW() WHERE id = $1', [id]),

    addCredits: (id, amount) => query('UPDATE users SET credits = credits + $1 WHERE id = $2', [amount, id]),

    spendCredits: async (id, amount) => {
        const { rows } = await query('UPDATE users SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING credits', [amount, id])
        return rows[0] || null
    },
}

module.exports = UserModel

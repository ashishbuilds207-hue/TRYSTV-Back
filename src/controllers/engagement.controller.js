const { query } = require('../config/database')
const { success, error } = require('../utils/response')

const DIARY_PROMPTS = [
    "Describe your ideal Tuesday evening in two sentences.",
    "What's the last thing that genuinely surprised you?",
    "Describe a moment you felt completely yourself.",
    "What kind of connection are you looking for right now?",
    "In two sentences, describe the feeling you're chasing.",
    "What does your perfect slow morning look like?",
    "Tell me something true before you tell me your name.",
]

const getEngagementHome = async (req, res) => {
    const userId = req.user.id
    try {
        const [meRes, chemRes, momentsRes, weeklyRes] = await Promise.all([
            query(`
                SELECT alias, desire_streak_count, streak_last_date, city,
                       desire_archetype, is_gold, is_obsidian, avatar_url
                FROM users WHERE id = $1
            `, [userId]),
            query(`
                SELECT m.id, COALESCE(m.chemistry_score, 0) AS chemistry_score,
                       u.alias, u.avatar_url, u.id AS partner_id
                FROM matches m
                JOIN users u ON (
                    CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
                ) = u.id
                WHERE (m.user1_id = $1 OR m.user2_id = $1) AND m.is_active = true
                ORDER BY m.chemistry_score DESC NULLS LAST LIMIT 1
            `, [userId]),
            query(`
                SELECT mc.id, mc.content, mc.city, mc.created_at, u.alias, u.avatar_url
                FROM moment_cards mc
                JOIN users u ON mc.user_id = u.id
                WHERE mc.expires_at > NOW()
                ORDER BY mc.created_at DESC LIMIT 6
            `),
            query(`
                SELECT wp.*, u.alias, u.avatar_url, u.age, u.bio,
                       u.desire_archetype, u.match_score, u.city
                FROM weekly_picks wp
                JOIN users u ON wp.picked_user_id = u.id
                WHERE wp.user_id = $1
                  AND wp.week_start = date_trunc('week', NOW())::date
                LIMIT 1
            `, [userId]),
        ])

        const me = meRes.rows[0]
        const hour = new Date().getHours()
        const isNight = hour >= 22 || hour < 4
        const dayPrompt = DIARY_PROMPTS[new Date().getDay() % DIARY_PROMPTS.length]

        const chem = chemRes.rows[0]
        success(res, {
            alias: me?.alias,
            avatarUrl: me?.avatar_url,
            city: me?.city,
            streak: me?.desire_streak_count || 0,
            streakLastDate: me?.streak_last_date,
            chemistry: chem ? {
                score: Math.round(chem.chemistry_score || 0),
                alias: chem.alias,
                avatarUrl: chem.avatar_url,
                partnerId: chem.partner_id,
            } : null,
            moments: momentsRes.rows.map(m => ({
                id: m.id, content: m.content, city: m.city,
                createdAt: m.created_at, alias: m.alias, avatarUrl: m.avatar_url,
            })),
            weeklyPick: weeklyRes.rows[0] ? {
                id: weeklyRes.rows[0].picked_user_id || weeklyRes.rows[0].id,
                alias: weeklyRes.rows[0].alias,
                avatarUrl: weeklyRes.rows[0].avatar_url,
                age: weeklyRes.rows[0].age,
                bio: weeklyRes.rows[0].bio,
                desireArchetype: weeklyRes.rows[0].desire_archetype,
                matchScore: weeklyRes.rows[0].match_score,
                city: weeklyRes.rows[0].city,
            } : null,
            isNight,
            archetype: me?.desire_archetype,
            isGold: me?.is_gold,
            diaryPrompt: dayPrompt,
        })
    } catch (err) {
        error(res, 'Failed to load home', 500)
    }
}

const checkInStreak = async (req, res) => {
    const userId = req.user.id
    try {
        const { rows } = await query(
            'SELECT desire_streak_count, streak_last_date FROM users WHERE id = $1',
            [userId]
        )
        const me = rows[0]
        const today = new Date().toISOString().split('T')[0]
        const lastDate = me?.streak_last_date
            ? new Date(me.streak_last_date).toISOString().split('T')[0]
            : null

        if (lastDate === today) {
            return success(res, { streak: me.desire_streak_count, alreadyCheckedIn: true })
        }

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const isConsecutive = lastDate === yesterday
        const newStreak = isConsecutive ? (me.desire_streak_count || 0) + 1 : 1

        await query(
            'UPDATE users SET desire_streak_count = $1, streak_last_date = $2 WHERE id = $3',
            [newStreak, today, userId]
        )
        success(res, { streak: newStreak, alreadyCheckedIn: false, isConsecutive })
    } catch {
        error(res, 'Streak check-in failed', 500)
    }
}

const saveDiaryAnswer = async (req, res) => {
    const userId = req.user.id
    const { prompt, answer } = req.body
    if (!prompt || !answer) return error(res, 'prompt and answer required', 400)
    try {
        await query(
            'INSERT INTO diary_entries (user_id, prompt, answer) VALUES ($1, $2, $3)',
            [userId, prompt, answer]
        )
        success(res, {}, 'Saved to your Desire Diary')
    } catch {
        error(res, 'Failed to save diary entry', 500)
    }
}

const getMoments = async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT mc.id, mc.content, mc.city, mc.created_at, u.alias, u.avatar_url
            FROM moment_cards mc
            JOIN users u ON mc.user_id = u.id
            WHERE mc.expires_at > NOW()
            ORDER BY mc.created_at DESC LIMIT 12
        `)
        success(res, { moments: rows })
    } catch {
        error(res, 'Failed to load moments', 500)
    }
}

const createMoment = async (req, res) => {
    const userId = req.user.id
    const { content } = req.body
    if (!content?.trim()) return error(res, 'content required', 400)
    try {
        const { rows: me } = await query('SELECT city FROM users WHERE id = $1', [userId])
        const { rows } = await query(
            'INSERT INTO moment_cards (user_id, city, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, me[0]?.city || 'Unknown', content.trim()]
        )
        success(res, { moment: rows[0] }, 'Moment shared')
    } catch {
        error(res, 'Failed to create moment', 500)
    }
}

const getWeeklyPick = async (req, res) => {
    const userId = req.user.id
    try {
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const weekStartStr = weekStart.toISOString().split('T')[0]

        const { rows: existing } = await query(`
            SELECT wp.*, u.alias, u.avatar_url, u.age, u.bio,
                   u.desire_archetype, u.match_score, u.city
            FROM weekly_picks wp
            JOIN users u ON wp.picked_user_id = u.id
            WHERE wp.user_id = $1 AND wp.week_start = $2
        `, [userId, weekStartStr])

        if (existing.length > 0) return success(res, { pick: existing[0] })

        const { rows: pick } = await query(`
            SELECT id, alias, avatar_url, age, bio, desire_archetype, match_score, city
            FROM users
            WHERE id != $1 AND is_active = true AND is_ghost_mode = false
              AND id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1)
              AND id NOT IN (SELECT picked_user_id FROM weekly_picks WHERE user_id = $1)
            ORDER BY match_score DESC NULLS LAST, RANDOM()
            LIMIT 1
        `, [userId])

        if (pick.length > 0) {
            await query(
                'INSERT INTO weekly_picks (user_id, picked_user_id, week_start) VALUES ($1, $2, $3)',
                [userId, pick[0].id, weekStartStr]
            )
            return success(res, { pick: pick[0] })
        }
        success(res, { pick: null })
    } catch {
        error(res, 'Failed to get weekly pick', 500)
    }
}

module.exports = {
    getEngagementHome, checkInStreak, saveDiaryAnswer,
    getMoments, createMoment, getWeeklyPick,
}

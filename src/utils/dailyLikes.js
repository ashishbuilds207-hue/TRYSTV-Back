const { query } = require('../config/database')

const DAILY_FREE_LIKES = 15

const getDailyLikeStatus = async (user) => {
    const today = new Date().toISOString().split('T')[0]
    const isGold = user.is_gold || user.is_obsidian
    if (isGold) {
        return { allowed: true, remaining: 999, limit: DAILY_FREE_LIKES, used: 0, isGold: true }
    }

    let used = user.daily_likes_count || 0
    if (!user.daily_likes_date || String(user.daily_likes_date).slice(0, 10) !== today) {
        used = 0
    }

    return {
        allowed: used < DAILY_FREE_LIKES,
        remaining: Math.max(0, DAILY_FREE_LIKES - used),
        limit: DAILY_FREE_LIKES,
        used,
        isGold: false,
    }
}

const consumeDailyLike = async (userId) => {
    const { rows } = await query('SELECT is_gold, is_obsidian, daily_likes_count, daily_likes_date FROM users WHERE id = $1', [userId])
    const user = rows[0]
    if (!user) return { allowed: false, remaining: 0 }

    const status = await getDailyLikeStatus(user)
    if (!status.allowed) return status

    if (status.isGold) return status

    const today = new Date().toISOString().split('T')[0]
    const lastDate = user.daily_likes_date ? String(user.daily_likes_date).slice(0, 10) : null
    const isNewDay = lastDate !== today

    if (isNewDay) {
        await query('UPDATE users SET daily_likes_count = 1, daily_likes_date = $1 WHERE id = $2', [today, userId])
        return { ...status, used: 1, remaining: DAILY_FREE_LIKES - 1 }
    }

    await query('UPDATE users SET daily_likes_count = daily_likes_count + 1 WHERE id = $1', [userId])
    const used = (user.daily_likes_count || 0) + 1
    return { ...status, used, remaining: Math.max(0, DAILY_FREE_LIKES - used) }
}

module.exports = { DAILY_FREE_LIKES, getDailyLikeStatus, consumeDailyLike }

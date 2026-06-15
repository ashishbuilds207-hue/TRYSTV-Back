const { verifyAccess } = require('../utils/jwt')
const { error } = require('../utils/response')
const { query } = require('../config/database')

const authenticate = async (req, res, next) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
        return error(res, 'No token provided', 401)
    }
    try {
        const token = header.split(' ')[1]
        const decoded = verifyAccess(token)
        const result = await query('SELECT id, alias, gender, is_active FROM users WHERE id = $1', [decoded.id])
        if (!result.rows[0] || !result.rows[0].is_active) {
            return error(res, 'Account not found or deactivated', 401)
        }
        req.user = result.rows[0]
        next()
    } catch {
        return error(res, 'Invalid or expired token', 401)
    }
}

const optionalAuth = async (req, res, next) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return next()
    try {
        const token = header.split(' ')[1]
        const decoded = verifyAccess(token)
        const result = await query('SELECT id, alias, gender FROM users WHERE id = $1', [decoded.id])
        if (result.rows[0]) req.user = result.rows[0]
    } catch {}
    next()
}

module.exports = { authenticate, optionalAuth }

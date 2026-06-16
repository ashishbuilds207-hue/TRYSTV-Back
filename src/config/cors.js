const DEFAULT_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
]

const getAllowedOrigins = () => {
    const fromList = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean)
    if (fromList?.length) return fromList

    const appUrl = process.env.APP_URL?.trim()
    if (appUrl) return [...new Set([appUrl, ...DEFAULT_ORIGINS])]

    return DEFAULT_ORIGINS
}

const corsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true)
    const allowed = getAllowedOrigins()
    if (allowed.includes(origin)) return callback(null, true)
    callback(null, false)
}

const getAppUrl = () => process.env.APP_URL?.trim() || 'http://localhost:3001'

module.exports = { getAllowedOrigins, corsOrigin, getAppUrl }

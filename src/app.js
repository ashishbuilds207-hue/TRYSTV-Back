require('dotenv').config()
require('express-async-errors')

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const { apiLimiter } = require('./middleware/rateLimiter.middleware')
const { error } = require('./utils/response')

const path = require('path')

const { corsOrigin } = require('./config/cors')

const app = express()

// Behind Nginx on EC2 — required for rate-limit + correct client IP
app.set('trust proxy', 1)

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(compression())
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── Static uploads ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ─── Rate Limit ────────────────────────────────────────────────────────────────
app.use('/api', apiLimiter)

const { checkDatabaseSchema } = require('./utils/dbHealth')

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/health/db', async (req, res) => {
    try {
        const schema = await checkDatabaseSchema()
        const status = schema.ok ? 200 : 503
        res.status(status).json({
            status: schema.ok ? 'ok' : 'degraded',
            missingTables: schema.missing,
            tables: schema.tables,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        res.status(503).json({ status: 'error', message: err.message })
    }
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'))
app.use('/api/users',         require('./routes/user.routes'))
app.use('/api/matches',       require('./routes/match.routes'))
app.use('/api/messages',      require('./routes/message.routes'))
app.use('/api/subscriptions', require('./routes/subscription.routes'))
app.use('/api/orbit',      require('./routes/orbit.routes'))
app.use('/api/pulse',      require('./routes/pulse.routes'))
app.use('/api/engagement', require('./routes/engagement.routes'))

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => error(res, `Route ${req.method} ${req.path} not found`, 404))

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack || err)

    if (err.code === '23505') {
        return error(res, 'This record already exists', 409)
    }
    if (err.code === '42P01') {
        return error(res, 'Database not fully migrated. Contact support.', 503)
    }

    const status = err.statusCode || err.status || 500
    const message =
        status === 500 && process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again.'
            : (err.message || 'Internal server error')

    error(res, message, status)
})

module.exports = app

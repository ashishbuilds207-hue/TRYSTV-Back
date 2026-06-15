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

const app = express()

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
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

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

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
    console.error(err.stack)
    error(res, err.message || 'Internal server error', err.statusCode || 500)
})

module.exports = app

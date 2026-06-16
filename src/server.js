require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')
const { pool } = require('./config/database')
const { connectRedis } = require('./config/redis')
const { initSockets } = require('./sockets')
const MessageModel = require('./models/message.model')
const { getAllowedOrigins } = require('./config/cors')
const { checkDatabaseSchema } = require('./utils/dbHealth')

const PORT = process.env.PORT || 5000

async function start() {
    // Test DB connection
    try {
        await pool.query('SELECT 1')
        console.log('✓ PostgreSQL connected')
    } catch (e) {
        console.error('✗ PostgreSQL connection failed:', e.message)
        process.exit(1)
    }

    try {
        const schema = await checkDatabaseSchema()
        if (!schema.ok) {
            console.warn('⚠ Database missing tables:', schema.missing.join(', '))
            console.warn('  Run: npm run migrate')
        } else {
            console.log(`✓ Database schema ok (${schema.tables.length} tables)`)
        }
    } catch (e) {
        console.warn('⚠ Could not verify database schema:', e.message)
    }

    // Connect Redis (optional — fall back if not available)
    try {
        await connectRedis()
    } catch (e) {
        console.warn('⚠ Redis unavailable, skipping cache layer')
    }

    // HTTP + Socket.io
    const server = http.createServer(app)
    const io = new Server(server, {
        cors: {
            origin: getAllowedOrigins(),
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
    })

    initSockets(io)

    // Cleanup expired messages every hour
    setInterval(() => MessageModel.deleteExpired(), 60 * 60 * 1000)

    server.listen(PORT, () => {
        console.log(`✓ TRYST API running on port ${PORT}`)
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`)
    })

    process.on('SIGTERM', async () => {
        await pool.end()
        server.close(() => process.exit(0))
    })
}

start()

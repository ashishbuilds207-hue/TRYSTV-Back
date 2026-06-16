const { Pool } = require('pg')

const isRds =
    process.env.DB_SSL === 'true' ||
    (process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST))

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isRds ? { rejectUnauthorized: false } : false,
})

pool.on('error', (err) => {
    console.error('Unexpected DB pool error', err)
})

const query = (text, params) => pool.query(text, params)

const getClient = () => pool.connect()

module.exports = { pool, query, getClient }

const { createClient } = require('redis')

let redisClient = null

const connectRedis = async () => {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
    redisClient.on('error', (err) => console.error('Redis error:', err))
    redisClient.on('connect', () => console.log('Redis connected'))
    await redisClient.connect()
    return redisClient
}

const getRedis = () => {
    if (!redisClient) throw new Error('Redis not connected')
    return redisClient
}

const setEx = (key, seconds, value) => getRedis().setEx(key, seconds, JSON.stringify(value))
const get = async (key) => {
    const val = await getRedis().get(key)
    return val ? JSON.parse(val) : null
}
const del = (key) => getRedis().del(key)

module.exports = { connectRedis, getRedis, setEx, get, del }

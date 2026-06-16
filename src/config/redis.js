const { createClient, createCluster } = require('redis')

let redisClient = null

const buildSocketOptions = (url) => {
    if (!url.startsWith('rediss://')) return undefined
    return { tls: true, rejectUnauthorized: false, connectTimeout: 10000 }
}

const connectRedis = async () => {
    const url = process.env.REDIS_URL || 'redis://localhost:6379'
    const socket = buildSocketOptions(url)

    if (url.includes('clustercfg.')) {
        redisClient = createCluster({
            rootNodes: [{ url }],
            defaults: { socket },
        })
    } else {
        redisClient = createClient({ url, socket })
    }

    redisClient.on('error', (err) => console.error('Redis error:', err))
    redisClient.on('connect', () => console.log('✓ Redis connected'))
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

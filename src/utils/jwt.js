const jwt = require('jsonwebtoken')

const generateTokens = (payload) => {
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    })
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    })
    return { accessToken, refreshToken }
}

const verifyAccess = (token) => jwt.verify(token, process.env.JWT_SECRET)

const verifyRefresh = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET)

module.exports = { generateTokens, verifyAccess, verifyRefresh }

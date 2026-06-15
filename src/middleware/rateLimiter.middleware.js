const rateLimit = require('express-rate-limit')

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many auth attempts, please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const otpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { success: false, message: 'OTP request limit reached. Wait 1 minute.' },
})

module.exports = { apiLimiter, authLimiter, otpLimiter }

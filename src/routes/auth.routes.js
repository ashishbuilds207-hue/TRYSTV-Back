const router = require('express').Router()
const { body } = require('express-validator')
const { validate } = require('../middleware/validate.middleware')
const { authenticate } = require('../middleware/auth.middleware')
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter.middleware')
const ctrl = require('../controllers/auth.controller')

router.post('/send-otp', otpLimiter,
    body('email').isEmail().normalizeEmail(),
    validate, ctrl.sendOtp)

router.post('/verify-otp', authLimiter,
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
    validate, ctrl.verifyOtpLogin)

router.post('/register',
    body('email').isEmail().normalizeEmail(),
    body('alias').isLength({ min: 2, max: 50 }),
    body('age').isInt({ min: 18, max: 99 }),
    body('gender').isIn(['male', 'female', 'other']),
    body('relationshipStatus').isIn(['married', 'partnered', 'open-relationship', 'discreet-single']),
    body('googleId').optional().isString().isLength({ min: 1, max: 255 }),
    body('avatarUrl').optional().isURL(),
    validate, ctrl.register)

router.post('/google', ctrl.googleLogin)
router.post('/google-access', ctrl.googleAccessLogin)
router.post('/refresh', ctrl.refreshToken)
router.get('/me', authenticate, ctrl.getMe)

module.exports = router

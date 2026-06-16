const router = require('express').Router()
const { body } = require('express-validator')
const { validate } = require('../middleware/validate.middleware')
const { authenticate } = require('../middleware/auth.middleware')
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter.middleware')
const ctrl = require('../controllers/auth.controller')

router.post('/send-otp', otpLimiter,
    body('phone').isMobilePhone('any'),
    validate, ctrl.sendOtp)

router.post('/verify-otp', authLimiter,
    body('phone').isMobilePhone('any'),
    body('otp').isLength({ min: 6, max: 6 }),
    validate, ctrl.verifyOtpLogin)

router.post('/register',
    body('phone').isMobilePhone('any'),
    body('alias').isLength({ min: 2, max: 50 }),
    body('age').isInt({ min: 18, max: 99 }),
    body('gender').isIn(['male', 'female', 'other']),
    body('relationshipStatus').isIn(['married', 'partnered', 'open-relationship', 'discreet-single']),
    validate, ctrl.register)

router.post('/google', ctrl.googleLogin)
router.post('/google-access', ctrl.googleAccessLogin)
router.post('/refresh', ctrl.refreshToken)
router.get('/me', authenticate, ctrl.getMe)

module.exports = router

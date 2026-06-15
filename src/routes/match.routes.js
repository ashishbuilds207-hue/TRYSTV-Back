const router = require('express').Router()
const { body } = require('express-validator')
const { validate } = require('../middleware/validate.middleware')
const { authenticate } = require('../middleware/auth.middleware')
const ctrl = require('../controllers/match.controller')

router.use(authenticate)

router.post('/swipe',
    body('targetId').isUUID(),
    body('direction').isIn(['like', 'pass', 'super']),
    validate, ctrl.swipe)

router.get('/', ctrl.getMatches)
router.get('/:id/call-consent', ctrl.getCallConsent)
router.post('/:id/call-consent', ctrl.setCallConsent)
router.get('/:id', ctrl.getMatch)

module.exports = router

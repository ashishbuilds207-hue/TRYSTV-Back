const router = require('express').Router()
const { body } = require('express-validator')
const { validate } = require('../middleware/validate.middleware')
const { authenticate } = require('../middleware/auth.middleware')
const ctrl = require('../controllers/message.controller')

router.use(authenticate)

router.get('/:matchId', ctrl.getMessages)
router.post('/:matchId',
    body('content').notEmpty().isLength({ max: 2000 }),
    body('type').optional().isIn(['text', 'voice', 'image']),
    validate, ctrl.sendMessage)
router.delete('/:id', ctrl.deleteMessage)

module.exports = router

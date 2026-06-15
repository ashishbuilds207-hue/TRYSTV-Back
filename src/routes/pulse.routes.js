const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const c = require('../controllers/pulse.controller')

router.use(authenticate)
router.get('/globe', c.getGlobeData)
router.get('/people', c.getWorldPeople)

module.exports = router

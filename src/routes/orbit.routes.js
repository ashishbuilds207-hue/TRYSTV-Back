const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const c = require('../controllers/orbit.controller')

router.use(authenticate)
router.get('/feed', c.getOrbitFeed)
router.post('/pull', c.recordPull)
router.post('/ignite', c.recordIgnite)
router.post('/pass', c.recordPass)

module.exports = router

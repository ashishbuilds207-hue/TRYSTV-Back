const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const c = require('../controllers/engagement.controller')

router.use(authenticate)
router.get('/home', c.getEngagementHome)
router.post('/streak', c.checkInStreak)
router.post('/diary', c.saveDiaryAnswer)
router.get('/moments', c.getMoments)
router.post('/moments', c.createMoment)
router.get('/weekly-pick', c.getWeeklyPick)

module.exports = router

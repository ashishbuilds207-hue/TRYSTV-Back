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
router.post('/daily-media', c.postDailyMedia)
router.post('/unlock-visitors', c.unlockVisitors)
router.post('/prompts/:id/like', c.likePrompt)
router.post('/prompts/:id/comment', c.commentPrompt)

module.exports = router

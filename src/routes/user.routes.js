const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const { upload } = require('../middleware/upload.middleware')
const ctrl = require('../controllers/user.controller')

router.use(authenticate)

router.get('/discover', ctrl.getDiscover)
router.get('/me', ctrl.getProfile)
router.get('/me/completion', ctrl.getProfileCompletion)
router.get('/me/daily-likes', ctrl.getDailyLikes)
router.patch('/me', ctrl.updateProfile)
router.post('/me/photos', upload.array('photos', 6), ctrl.uploadPhotos)
router.delete('/me/photos/:index', ctrl.deletePhoto)
router.patch('/me/photos/:index/avatar', ctrl.setAvatarPhoto)
router.post('/ghost-mode', ctrl.toggleGhostMode)
router.post('/disguise', ctrl.toggleDisguise)
router.get('/notifications/list', ctrl.getNotifications)
router.patch('/notifications/:id/read', ctrl.markNotificationRead)
router.get('/:id', ctrl.getProfile)

module.exports = router

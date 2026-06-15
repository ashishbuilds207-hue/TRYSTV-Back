const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const ctrl = require('../controllers/subscription.controller')

router.get('/plans', ctrl.getPlans)
router.use(authenticate)
router.get('/my', ctrl.getSubscription)
router.post('/order', ctrl.createOrder)
router.post('/verify', ctrl.verifyPayment)

module.exports = router

const { query } = require('../config/database')
const { success, error } = require('../utils/response')
const UserModel = require('../models/user.model')

const PLANS = {
    gold_monthly:  { price: 999,  credits: 0,   days: 30,  label: 'TRYST Gold Monthly' },
    gold_annual:   { price: 3999, credits: 0,   days: 365, label: 'TRYST Gold Annual' },
    obsidian:      { price: 4999, credits: 200, days: 30,  label: 'TRYST Obsidian' },
    credits_50:    { price: 499,  credits: 50,  days: 0,   label: '50 Message Credits' },
    credits_150:   { price: 1299, credits: 150, days: 0,   label: '150 Message Credits' },
    boost:         { price: 199,  credits: 0,   days: 0,   label: 'Profile Boost' },
    incognito:     { price: 299,  credits: 0,   days: 7,   label: 'Incognito Mode (7 days)' },
}

const getPlans = (req, res) => success(res, { plans: PLANS })

const createOrder = async (req, res) => {
    const { plan } = req.body
    if (!PLANS[plan]) return error(res, 'Invalid plan', 400)

    // In dev, return mock order
    if (process.env.NODE_ENV === 'development') {
        return success(res, {
            orderId: `dev_order_${Date.now()}`,
            plan,
            amount: PLANS[plan].price,
            currency: 'INR',
        })
    }

    try {
        const Razorpay = require('razorpay')
        const rp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
        const order = await rp.orders.create({ amount: PLANS[plan].price * 100, currency: 'INR', notes: { plan, userId: req.user.id } })
        success(res, { orderId: order.id, plan, amount: PLANS[plan].price, currency: 'INR' })
    } catch (e) {
        error(res, 'Payment gateway error', 500)
    }
}

const verifyPayment = async (req, res) => {
    const { plan, orderId, paymentId } = req.body
    const planData = PLANS[plan]
    if (!planData) return error(res, 'Invalid plan', 400)

    const userId = req.user.id

    if (planData.credits > 0) {
        await UserModel.addCredits(userId, planData.credits)
        await query('INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1,$2,$3,$4)',
            [userId, planData.credits, 'purchase', planData.label])
    }

    if (planData.days > 0) {
        const endsAt = new Date(Date.now() + planData.days * 24 * 60 * 60 * 1000)
        await query('INSERT INTO subscriptions (user_id, plan, ends_at) VALUES ($1,$2,$3)', [userId, plan, endsAt])

        if (plan.startsWith('gold')) {
            await query('UPDATE users SET is_gold = true WHERE id = $1', [userId])
        } else if (plan === 'obsidian') {
            await query('UPDATE users SET is_obsidian = true, is_gold = true WHERE id = $1', [userId])
        }
    }

    success(res, { activated: true, plan }, 'Payment verified')
}

const getSubscription = async (req, res) => {
    const { rows } = await query('SELECT * FROM subscriptions WHERE user_id = $1 AND ends_at > NOW() ORDER BY ends_at DESC LIMIT 1', [req.user.id])
    success(res, { subscription: rows[0] || null })
}

module.exports = { getPlans, createOrder, verifyPayment, getSubscription }

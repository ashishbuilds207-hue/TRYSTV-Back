const sgMail = require('@sendgrid/mail')
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const { getAppUrl } = require('../config/cors')

const FROM = {
    email: process.env.SENDGRID_FROM_EMAIL || process.env.ADMIN_EMAIL || 'hello@tryst.app',
    name: process.env.SENDGRID_FROM_NAME || 'TRYST',
}
const appUrl = () => getAppUrl()

const templates = {
    welcome: (alias) => ({
        subject: `Welcome to TRYST, ${alias}`,
        html: `
        <div style="background:#0D0707;color:#F8F4ED;font-family:Inter,sans-serif;padding:40px;max-width:560px;margin:0 auto;border-radius:12px;">
            <h1 style="font-family:Georgia,serif;color:#C0392B;font-size:36px;margin:0 0 8px;">TRYST</h1>
            <p style="color:#D4AF37;font-style:italic;margin:0 0 32px;">"Your Secret. Your Story."</p>
            <h2 style="color:#F8F4ED;font-size:22px;">Welcome, ${alias}.</h2>
            <p style="color:#8A6060;line-height:1.7;">Your story begins now. Discover connections that feel like a secret worth keeping. Your privacy is our promise.</p>
            <div style="margin:32px 0;padding:20px;background:#1E1414;border:1px solid #2E1E1E;border-radius:8px;">
                <p style="color:#F8F4ED;margin:0;font-size:14px;">Your alias: <strong style="color:#D4AF37;">${alias}</strong></p>
                <p style="color:#6B4F4F;margin:8px 0 0;font-size:12px;">Your real name is never shown on TRYST.</p>
            </div>
            <a href="${appUrl()}/discover" style="display:inline-block;background:linear-gradient(135deg,#C0392B,#922B21);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Begin Discovering</a>
            <p style="color:#3D2828;font-size:12px;margin-top:32px;">© 2025 TRYST · All interactions are encrypted and private.</p>
        </div>`,
    }),

    match: (alias, matchAlias) => ({
        subject: `You have a Spark with ${matchAlias}`,
        html: `
        <div style="background:#0D0707;color:#F8F4ED;font-family:Inter,sans-serif;padding:40px;max-width:560px;margin:0 auto;border-radius:12px;">
            <h1 style="font-family:Georgia,serif;color:#C0392B;font-size:36px;margin:0 0 32px;">TRYST</h1>
            <h2 style="color:#F8F4ED;font-size:22px;">It's a Spark, ${alias}! ✦</h2>
            <p style="color:#8A6060;line-height:1.7;">You and <strong style="color:#D4AF37;">${matchAlias}</strong> have both expressed interest. The connection is yours to explore.</p>
            <a href="${appUrl()}/chat" style="display:inline-block;background:linear-gradient(135deg,#C0392B,#922B21);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:24px;">Send a Message</a>
            <p style="color:#3D2828;font-size:12px;margin-top:32px;">© 2025 TRYST · This email was sent to protect your privacy notifications.</p>
        </div>`,
    }),

    otp: (otp) => ({
        subject: 'Your TRYST verification code',
        html: `
        <div style="background:#0D0707;color:#F8F4ED;font-family:Inter,sans-serif;padding:40px;max-width:560px;margin:0 auto;border-radius:12px;">
            <h1 style="font-family:Georgia,serif;color:#C0392B;font-size:36px;margin:0 0 32px;">TRYST</h1>
            <h2 style="color:#F8F4ED;">Your verification code</h2>
            <p style="color:#8A6060;font-size:14px;margin:0 0 16px;">Enter this code to sign in or complete registration. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
            <div style="background:#1E1414;border:1px solid #C0392B;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
                <span style="color:#F8F4ED;font-size:40px;font-weight:700;letter-spacing:12px;">${otp}</span>
            </div>
            <p style="color:#8A6060;font-size:14px;">Never share this code with anyone. TRYST will never ask for it by phone or chat.</p>
            <p style="color:#3D2828;font-size:12px;margin-top:32px;">© 2025 TRYST · Private by design.</p>
        </div>`,
    }),
}

const buildMessage = (type, data) => {
    const tmpl = templates[type]
    if (!tmpl) throw new Error(`Unknown email type: ${type}`)

    if (type === 'otp') return tmpl(data.otp)
    if (type === 'welcome') return tmpl(data.alias)
    if (type === 'match') return tmpl(data.alias, data.matchAlias)
    return tmpl
}

const sendEmail = async (to, type, data = {}) => {
    if (!to) throw new Error('Email recipient required')

    const { subject, html } = buildMessage(type, data)
    const logOnly = process.env.OTP_LOG_ONLY === 'true'

    // OTP emails: send whenever SendGrid is configured and not log-only (local + production)
    const sendOtp = type === 'otp' && process.env.SENDGRID_API_KEY && !logOnly
    const sendOther = type !== 'otp' && process.env.NODE_ENV !== 'development' && process.env.SENDGRID_API_KEY

    if (!sendOtp && !sendOther) {
        const extra = type === 'otp' && data.otp ? ` code=${data.otp}` : ''
        console.log(`[Email → ${to}] ${type}${extra}`)
        return
    }

    if (!process.env.SENDGRID_API_KEY) {
        throw new Error('Email service is not configured.')
    }

    await sgMail.send({ to, from: FROM, subject, html })
}

module.exports = { sendEmail }

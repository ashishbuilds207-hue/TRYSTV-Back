const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))

module.exports = { normalizeEmail, isValidEmail }

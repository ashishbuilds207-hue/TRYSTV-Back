/** Normalize Indian numbers to E.164 (+91XXXXXXXXXX) */
const normalizePhone = (phone) => {
    if (!phone) return phone
    const trimmed = String(phone).trim()
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
    if (trimmed.startsWith('+')) return trimmed
    return `+${digits}`
}

module.exports = { normalizePhone }

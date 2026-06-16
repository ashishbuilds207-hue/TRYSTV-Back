const { query } = require('../config/database')
const REQUIRED_TABLES = require('../db/requiredTables')

async function checkDatabaseSchema() {
    const { rows } = await query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const existing = new Set(rows.map((r) => r.table_name))
    const missing = REQUIRED_TABLES.filter((t) => !existing.has(t))
    return {
        ok: missing.length === 0,
        tables: REQUIRED_TABLES.map((t) => ({ name: t, exists: existing.has(t) })),
        missing,
    }
}

module.exports = { checkDatabaseSchema }

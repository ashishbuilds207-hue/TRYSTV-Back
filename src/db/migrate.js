require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { pool } = require('../config/database')
const REQUIRED_TABLES = require('./requiredTables')

const MIGRATION_FILES = [
    'migration_v1_base.sql',
    'migration_otp_store.sql',
    'migration_v2.sql',
    'migration_v3.sql',
]

async function runSqlFile(filePath) {
    const sql = fs.readFileSync(filePath, 'utf8')
    await pool.query(sql)
}

async function verifyTables() {
    const { rows } = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const existing = new Set(rows.map((r) => r.table_name))
    const missing = REQUIRED_TABLES.filter((t) => !existing.has(t))
    return { existing: [...existing].sort(), missing }
}

async function migrate() {
    console.log('TRYST database migration')
    console.log(`  host: ${process.env.DB_HOST}`)
    console.log(`  db:   ${process.env.DB_NAME}`)

    const dbDir = __dirname
    for (const file of MIGRATION_FILES) {
        const filePath = path.join(dbDir, file)
        if (!fs.existsSync(filePath)) {
            console.warn(`  skip (not found): ${file}`)
            continue
        }
        process.stdout.write(`  running ${file}...`)
        await runSqlFile(filePath)
        console.log(' ok')
    }

    const { existing, missing } = await verifyTables()
    console.log(`\n  tables in DB: ${existing.length}`)

    if (missing.length) {
        console.error('\n  MISSING TABLES (will cause 500 errors):')
        missing.forEach((t) => console.error(`    - ${t}`))
        process.exit(1)
    }

    console.log('\n  All required tables present.')
    REQUIRED_TABLES.forEach((t) => console.log(`    ✓ ${t}`))
}

migrate()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\nMigration failed:', err.message)
        process.exit(1)
    })

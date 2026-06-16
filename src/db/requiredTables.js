/**
 * Every PostgreSQL table referenced in the TRYST backend codebase.
 * If any is missing, APIs will return 500 — run `npm run migrate`.
 */
module.exports = [
    'users',
    'otp_store',
    'swipes',
    'matches',
    'conversations',
    'messages',
    'notifications',
    'subscriptions',
    'credit_transactions',
    'diary_entries',
    'moment_cards',
    'weekly_picks',
    'feature_flags',
]

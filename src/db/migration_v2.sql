-- TRYST v2 Migration — new columns for Orbit, Engagement, Disguise, Call Consent
-- Run: psql -U postgres -d tryst_db -f migration_v2.sql

-- ─── USERS: extended profile fields ────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS desire_archetype VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_mask INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blur_default BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS incognito_on_start BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_exact_distance BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS calls_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS video_calls_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS desire_streak_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_last_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_interests TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS disguise_mode_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_disguise_skin VARCHAR(30) DEFAULT 'newspaper';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_night_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS build VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS orientation VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS seeking VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_pref_min INTEGER DEFAULT 18;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_pref_max INTEGER DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_distance_km INTEGER DEFAULT 50;

-- ─── MATCHES: call consent + chemistry ──────────────────────────────────────────
ALTER TABLE matches ADD COLUMN IF NOT EXISTS interaction_type VARCHAR(10) DEFAULT 'MATCH';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_a_calls_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_b_calls_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS chemistry_score FLOAT DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS chemistry_last_updated TIMESTAMP;

-- ─── DIARY ENTRIES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─── MOMENT CARDS (city-scoped ephemeral stories) ───────────────────────────────
CREATE TABLE IF NOT EXISTS moment_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city VARCHAR(100),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')
);

-- ─── WEEKLY PICKS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    picked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- ─── FEATURE FLAGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    flag_key VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    tier_restriction VARCHAR(20),
    rollout_percent INTEGER DEFAULT 100,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO feature_flags (flag_key, enabled) VALUES
    ('pulse_globe', true),
    ('disguise_mode', true),
    ('night_mode', true),
    ('call_feature', true),
    ('orbit_ui', true),
    ('desire_diary', true),
    ('weekly_pick', true)
ON CONFLICT (flag_key) DO NOTHING;

-- ─── SEED MOMENT CARDS for demo ─────────────────────────────────────────────────
DO $$
DECLARE u_id UUID;
BEGIN
    SELECT id INTO u_id FROM users LIMIT 1;
    IF u_id IS NOT NULL THEN
        INSERT INTO moment_cards (user_id, city, content) VALUES
            (u_id, 'Mumbai', 'I keep a good bottle for a night that keeps not coming.'),
            (u_id, 'Delhi', 'Some conversations are worth missing your flight for.'),
            (u_id, 'Bangalore', 'Tell me the last thing that genuinely surprised you.')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ─── UPDATE existing dummy users with desire_archetype ──────────────────────────
UPDATE users SET desire_archetype = CASE (random() * 4)::INT
    WHEN 0 THEN 'WANDERER'
    WHEN 1 THEN 'FLAME'
    WHEN 2 THEN 'GHOST'
    WHEN 3 THEN 'SPARK'
    ELSE 'STORY'
END
WHERE desire_archetype IS NULL;

UPDATE users SET desire_streak_count = (random() * 12)::INT
WHERE desire_streak_count = 0;

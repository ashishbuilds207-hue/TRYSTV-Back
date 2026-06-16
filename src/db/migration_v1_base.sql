-- TRYST base schema — run once on empty database (idempotent: CREATE IF NOT EXISTS)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias VARCHAR(50) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    age INTEGER,
    gender VARCHAR(20),
    relationship_status VARCHAR(30),
    profession VARCHAR(100),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    bio TEXT,
    desire_tags TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    is_gold BOOLEAN DEFAULT FALSE,
    is_obsidian BOOLEAN DEFAULT FALSE,
    credits INTEGER DEFAULT 10,
    match_score FLOAT DEFAULT 0,
    is_ghost_mode BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    -- v2 profile
    desire_archetype VARCHAR(10),
    availability_mask INTEGER DEFAULT 0,
    blur_default BOOLEAN DEFAULT TRUE,
    incognito_on_start BOOLEAN DEFAULT FALSE,
    show_exact_distance BOOLEAN DEFAULT FALSE,
    calls_enabled BOOLEAN DEFAULT FALSE,
    video_calls_enabled BOOLEAN DEFAULT FALSE,
    desire_streak_count INTEGER DEFAULT 0,
    streak_last_date DATE,
    social_verified BOOLEAN DEFAULT FALSE,
    social_interests TEXT[] DEFAULT '{}',
    disguise_mode_enabled BOOLEAN DEFAULT FALSE,
    active_disguise_skin VARCHAR(30) DEFAULT 'newspaper',
    is_night_mode BOOLEAN DEFAULT FALSE,
    height_cm INTEGER,
    build VARCHAR(20),
    orientation VARCHAR(30),
    seeking VARCHAR(20),
    age_pref_min INTEGER DEFAULT 18,
    age_pref_max INTEGER DEFAULT 50,
    max_distance_km INTEGER DEFAULT 50,
    -- v3 location & limits
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    daily_likes_count INTEGER DEFAULT 0,
    daily_likes_date DATE
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_city ON users (city);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);

-- ─── SWIPES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (swiper_id, swiped_id)
);

CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes (swiper_id);

-- ─── MATCHES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_spark BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    interaction_type VARCHAR(10) DEFAULT 'MATCH',
    user_a_calls_consent BOOLEAN DEFAULT FALSE,
    user_b_calls_consent BOOLEAN DEFAULT FALSE,
    chemistry_score FLOAT DEFAULT 0,
    chemistry_last_updated TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

-- ─── CONVERSATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
    delete_timer INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─── MESSAGES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at);

-- ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─── CREDIT TRANSACTIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(30) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─── DIARY / MOMENTS / WEEKLY PICKS / FLAGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moment_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city VARCHAR(100),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE TABLE IF NOT EXISTS weekly_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    picked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, week_start)
);

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

-- ─── OTP (phone login) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_store (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_store_phone ON otp_store (phone);
CREATE INDEX IF NOT EXISTS idx_otp_store_expires ON otp_store (expires_at);

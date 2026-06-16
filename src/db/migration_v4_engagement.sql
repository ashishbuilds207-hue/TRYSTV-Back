-- Profile visitors, anonymous prompts, read receipts

CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON profile_views(viewed_id, created_at DESC);

CREATE TABLE IF NOT EXISTS anonymous_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_type VARCHAR(20) NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_anonymous_prompts_active ON anonymous_prompts(expires_at DESC);

CREATE TABLE IF NOT EXISTS prompt_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES anonymous_prompts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_likes (
    prompt_id UUID NOT NULL REFERENCES anonymous_prompts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (prompt_id, user_id)
);

CREATE TABLE IF NOT EXISTS daily_media_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL,
    content TEXT,
    media_url TEXT,
    points_awarded INT DEFAULT 0,
    post_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, media_type, post_date)
);

-- Read receipts on messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW();

-- App icon preference (cosmetic)
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_icon_skin VARCHAR(50) DEFAULT 'tryst';
ALTER TABLE users ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN DEFAULT true;

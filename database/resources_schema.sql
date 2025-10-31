-- Resources Database Schema
-- For tracking learning resources and materials
-- Note: This schema depends on users table (see users_schema.sql)

-- Resources table - tracks learning materials users are using
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('book', 'manga', 'video_game', 'news_article', 'anime', 'podcast', 'website')),
    status VARCHAR(50) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'dropped')),
    description TEXT,
    image_path VARCHAR(1000),  -- File path to uploaded image
    difficulty_level VARCHAR(50) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    tags TEXT[],  -- Array of custom tags
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_resources_user_id ON resources(user_id);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_status ON resources(status);
CREATE INDEX idx_resources_difficulty ON resources(difficulty_level);
CREATE INDEX idx_resources_tags ON resources USING GIN(tags);

-- Trigger to update updated_at timestamp on resources
CREATE OR REPLACE FUNCTION update_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resources_updated_at_trigger
    BEFORE UPDATE ON resources
    FOR EACH ROW
    EXECUTE FUNCTION update_resources_updated_at();

-- Example queries for reference:

-- Get all resources for a user
-- SELECT * FROM resources WHERE user_id = 1 ORDER BY created_at DESC;

-- Get resources by status
-- SELECT * FROM resources WHERE user_id = 1 AND status = 'in_progress';

-- Get resources by type
-- SELECT * FROM resources WHERE user_id = 1 AND type = 'manga';

-- Search resources by name
-- SELECT * FROM resources WHERE user_id = 1 AND name ILIKE '%naruto%';

-- Get resources by difficulty level
-- SELECT * FROM resources WHERE user_id = 1 AND difficulty_level = 'beginner';

-- Get resources with a specific tag
-- SELECT * FROM resources WHERE user_id = 1 AND 'grammar' = ANY(tags);

-- Get resources by multiple tags
-- SELECT * FROM resources WHERE user_id = 1 AND tags && ARRAY['grammar', 'vocabulary'];

-- Count resources by status
-- SELECT status, COUNT(*) FROM resources WHERE user_id = 1 GROUP BY status;

-- Count resources by type
-- SELECT type, COUNT(*) FROM resources WHERE user_id = 1 GROUP BY type;


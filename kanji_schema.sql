-- Postgres DDL for KANJIDIC2 Database
-- Focused on English language translations
-- Generated from kanjidic2.xml structure

-- Main kanji table
CREATE TABLE kanji (
    id SERIAL PRIMARY KEY,
    literal VARCHAR(10) NOT NULL UNIQUE,  -- The kanji character itself
    unicode_codepoint VARCHAR(10),         -- Unicode hex value (e.g., '4e9c')
    
    -- Classification
    classical_radical INTEGER,             -- Radical number (1-214)
    stroke_count INTEGER NOT NULL,         -- Primary stroke count
    
    -- Learning metadata
    grade INTEGER,                         -- Grade level: 1-6 (Kyouiku), 8 (Jouyou), 9-10 (Jinmeiyou)
    frequency_rank INTEGER,                -- Frequency ranking (1-2500, lower is more common)
    jlpt_level INTEGER,                    -- Old JLPT level (1-4, where 1 is most advanced)
    
    -- Readings (stored as arrays for multiple values)
    on_readings TEXT[],                    -- On readings in katakana
    kun_readings TEXT[],                   -- Kun readings in hiragana
    nanori_readings TEXT[],                -- Name readings
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- English meanings table (one-to-many relationship)
CREATE TABLE kanji_meanings (
    id SERIAL PRIMARY KEY,
    kanji_id INTEGER NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
    meaning TEXT NOT NULL,
    meaning_order INTEGER NOT NULL,       -- Preserve order from source
    
    UNIQUE(kanji_id, meaning_order)
);

-- Indexes for common queries
CREATE INDEX idx_kanji_literal ON kanji(literal);
CREATE INDEX idx_kanji_unicode ON kanji(unicode_codepoint);
CREATE INDEX idx_kanji_grade ON kanji(grade);
CREATE INDEX idx_kanji_frequency ON kanji(frequency_rank);
CREATE INDEX idx_kanji_jlpt ON kanji(jlpt_level);
CREATE INDEX idx_kanji_stroke_count ON kanji(stroke_count);
CREATE INDEX idx_kanji_radical ON kanji(classical_radical);
CREATE INDEX idx_kanji_meanings_kanji_id ON kanji_meanings(kanji_id);

-- Useful view that combines kanji with their meanings
CREATE VIEW kanji_with_meanings AS
SELECT 
    k.id,
    k.literal,
    k.unicode_codepoint,
    k.classical_radical,
    k.stroke_count,
    k.grade,
    k.frequency_rank,
    k.jlpt_level,
    k.on_readings,
    k.kun_readings,
    k.nanori_readings,
    ARRAY_AGG(km.meaning ORDER BY km.meaning_order) AS meanings
FROM kanji k
LEFT JOIN kanji_meanings km ON k.id = km.kanji_id
GROUP BY k.id;

-- ============================================================
-- Example Queries
-- ============================================================

-- Get all N5/N4 JLPT kanji (levels 3-4)
-- SELECT * FROM kanji WHERE jlpt_level IN (3, 4) ORDER BY frequency_rank;

-- Get most common kanji
-- SELECT * FROM kanji WHERE frequency_rank IS NOT NULL ORDER BY frequency_rank LIMIT 100;

-- Search by meaning
-- SELECT k.* FROM kanji k 
-- JOIN kanji_meanings km ON k.id = km.kanji_id 
-- WHERE km.meaning ILIKE '%water%';

-- Get all Kyouiku kanji (elementary school)
-- SELECT * FROM kanji WHERE grade BETWEEN 1 AND 6 ORDER BY grade, frequency_rank;

-- Get kanji by stroke count
-- SELECT * FROM kanji WHERE stroke_count = 5 ORDER BY frequency_rank;

-- Search kanji by reading
-- SELECT * FROM kanji WHERE 'ミズ' = ANY(on_readings);
-- SELECT * FROM kanji WHERE 'みず' = ANY(kun_readings);

-- Get all kanji for a specific radical
-- SELECT * FROM kanji WHERE classical_radical = 85 ORDER BY stroke_count;


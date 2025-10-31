-- JMDict (Japanese-English Dictionary) Database Schema
-- Based on JMDict_e XML structure

-- Main dictionary entries table
CREATE TABLE dictionary_entries (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER UNIQUE NOT NULL,  -- JMDict entry sequence number
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Japanese word forms (kanji/kana writings)
CREATE TABLE entry_kanji (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
    kanji TEXT NOT NULL,                -- The kanji/kana form
    is_common BOOLEAN DEFAULT FALSE,    -- Common word indicator
    priority_tags TEXT[],               -- news1, ichi1, spec1, gai1, etc.
    info TEXT[],                        -- Additional info (rarely used form, etc.)
    kanji_order INTEGER NOT NULL,       -- Order of appearance
    
    UNIQUE(entry_id, kanji_order)
);

-- Japanese readings (kana pronunciations)
CREATE TABLE entry_readings (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
    reading TEXT NOT NULL,              -- Kana reading
    is_common BOOLEAN DEFAULT FALSE,    -- Common reading indicator
    priority_tags TEXT[],               -- news1, ichi1, spec1, gai1, etc.
    info TEXT[],                        -- Additional info
    reading_order INTEGER NOT NULL,     -- Order of appearance
    
    UNIQUE(entry_id, reading_order)
);

-- Senses (meanings/definitions)
CREATE TABLE entry_senses (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
    sense_order INTEGER NOT NULL,       -- Order of sense within entry
    parts_of_speech TEXT[],             -- noun, verb, adjective, etc.
    fields TEXT[],                      -- Field of application (医, 仏, etc.)
    misc TEXT[],                        -- Miscellaneous info
    dialects TEXT[],                    -- Dialect information
    
    UNIQUE(entry_id, sense_order)
);

-- English glosses/translations for each sense
CREATE TABLE sense_glosses (
    id SERIAL PRIMARY KEY,
    sense_id INTEGER NOT NULL REFERENCES entry_senses(id) ON DELETE CASCADE,
    gloss TEXT NOT NULL,                -- English translation
    gloss_type VARCHAR(50),             -- literal, figurative, explanation, etc.
    gloss_order INTEGER NOT NULL,       -- Order within sense
    
    UNIQUE(sense_id, gloss_order)
);

-- Cross-references between entries
CREATE TABLE entry_cross_references (
    id SERIAL PRIMARY KEY,
    sense_id INTEGER NOT NULL REFERENCES entry_senses(id) ON DELETE CASCADE,
    xref_text TEXT NOT NULL,            -- Reference text
    xref_type VARCHAR(50)               -- synonym, antonym, see also, etc.
);

-- Junction table linking dictionary entries to kanji characters
-- This decomposes kanji in words and links to the kanji table
CREATE TABLE entry_kanji_characters (
    id SERIAL PRIMARY KEY,
    entry_kanji_id INTEGER NOT NULL REFERENCES entry_kanji(id) ON DELETE CASCADE,
    kanji_id INTEGER NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,          -- Position of kanji in the word (0-indexed)
    
    UNIQUE(entry_kanji_id, position)
);

-- Indexes for common queries
CREATE INDEX idx_entry_kanji_entry_id ON entry_kanji(entry_id);
CREATE INDEX idx_entry_kanji_kanji ON entry_kanji(kanji);
CREATE INDEX idx_entry_kanji_common ON entry_kanji(is_common);

CREATE INDEX idx_entry_readings_entry_id ON entry_readings(entry_id);
CREATE INDEX idx_entry_readings_reading ON entry_readings(reading);
CREATE INDEX idx_entry_readings_common ON entry_readings(is_common);

CREATE INDEX idx_entry_senses_entry_id ON entry_senses(entry_id);
CREATE INDEX idx_entry_senses_pos ON entry_senses USING GIN(parts_of_speech);

CREATE INDEX idx_sense_glosses_sense_id ON sense_glosses(sense_id);
CREATE INDEX idx_sense_glosses_gloss ON sense_glosses USING gin(to_tsvector('english', gloss));

CREATE INDEX idx_entry_kanji_characters_entry_kanji_id ON entry_kanji_characters(entry_kanji_id);
CREATE INDEX idx_entry_kanji_characters_kanji_id ON entry_kanji_characters(kanji_id);

-- Useful view that combines entry information
CREATE VIEW dictionary_entries_view AS
SELECT 
    de.id,
    de.entry_id,
    ARRAY_AGG(ek.kanji ORDER BY ek.kanji_order) FILTER (WHERE ek.kanji IS NOT NULL) as kanji_forms,
    ARRAY_AGG(er.reading ORDER BY er.reading_order) FILTER (WHERE er.reading IS NOT NULL) as readings
FROM dictionary_entries de
LEFT JOIN entry_kanji ek ON de.id = ek.entry_id
LEFT JOIN entry_readings er ON de.id = er.entry_id
GROUP BY de.id, de.entry_id;

-- ============================================================
-- Example Queries
-- ============================================================

-- Search for a word by kanji
-- SELECT de.*, ek.kanji, er.reading, sg.gloss
-- FROM dictionary_entries de
-- JOIN entry_kanji ek ON de.id = ek.entry_id
-- JOIN entry_readings er ON de.id = er.entry_id
-- JOIN entry_senses es ON de.id = es.entry_id
-- JOIN sense_glosses sg ON es.id = sg.sense_id
-- WHERE ek.kanji = '食べる';

-- Search for words by English meaning
-- SELECT DISTINCT de.entry_id, ek.kanji, er.reading, sg.gloss
-- FROM dictionary_entries de
-- JOIN entry_kanji ek ON de.id = ek.entry_id
-- JOIN entry_readings er ON de.id = er.entry_id
-- JOIN entry_senses es ON de.id = es.entry_id
-- JOIN sense_glosses sg ON es.id = sg.sense_id
-- WHERE sg.gloss ILIKE '%eat%';

-- Get all common words (news/ichi priority)
-- SELECT de.entry_id, ek.kanji, er.reading
-- FROM dictionary_entries de
-- JOIN entry_kanji ek ON de.id = ek.entry_id
-- JOIN entry_readings er ON de.id = er.entry_id
-- WHERE ek.is_common = true OR er.is_common = true;

-- Search by reading
-- SELECT de.entry_id, ek.kanji, er.reading, sg.gloss
-- FROM dictionary_entries de
-- JOIN entry_kanji ek ON de.id = ek.entry_id
-- JOIN entry_readings er ON de.id = er.entry_id
-- JOIN entry_senses es ON de.id = es.entry_id
-- JOIN sense_glosses sg ON es.id = sg.sense_id
-- WHERE er.reading = 'たべる';

-- Get words by part of speech
-- SELECT DISTINCT de.entry_id, ek.kanji, er.reading
-- FROM dictionary_entries de
-- JOIN entry_kanji ek ON de.id = ek.entry_id
-- JOIN entry_readings er ON de.id = er.entry_id
-- JOIN entry_senses es ON de.id = es.entry_id
-- WHERE 'v1' = ANY(es.parts_of_speech);  -- Ichidan verbs

-- Find all words containing a specific kanji
-- SELECT DISTINCT de.entry_id, ek.kanji, er.reading, sg.gloss, k.literal
-- FROM dictionary_entries de
-- JOIN entry_kanji ek ON de.id = ek.entry_id
-- JOIN entry_readings er ON de.id = er.entry_id
-- JOIN entry_senses es ON de.id = es.entry_id
-- JOIN sense_glosses sg ON es.id = sg.sense_id
-- JOIN entry_kanji_characters ekc ON ek.id = ekc.entry_kanji_id
-- JOIN kanji k ON ekc.kanji_id = k.id
-- WHERE k.literal = '食';

-- Find all kanji used in a specific word
-- SELECT k.literal, k.frequency_rank, k.grade, k.jlpt_level, ekc.position
-- FROM entry_kanji ek
-- JOIN entry_kanji_characters ekc ON ek.id = ekc.entry_kanji_id
-- JOIN kanji k ON ekc.kanji_id = k.id
-- WHERE ek.kanji = '食べる'
-- ORDER BY ekc.position;

-- Get vocabulary words for learning a specific kanji (by grade level)
-- SELECT DISTINCT ek.kanji, er.reading, sg.gloss, k.literal, k.grade
-- FROM kanji k
-- JOIN entry_kanji_characters ekc ON k.id = ekc.kanji_id
-- JOIN entry_kanji ek ON ekc.entry_kanji_id = ek.id
-- JOIN dictionary_entries de ON ek.entry_id = de.id
-- JOIN entry_readings er ON de.id = er.entry_id
-- JOIN entry_senses es ON de.id = es.entry_id
-- JOIN sense_glosses sg ON es.id = sg.sense_id
-- WHERE k.grade = 1  -- First grade kanji
-- AND ek.is_common = true
-- ORDER BY k.literal, ek.kanji;


import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// GET /api/words - Get dictionary entries with optional search
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        de.id,
        de.entry_id,
        ARRAY_AGG(DISTINCT ek.kanji) FILTER (WHERE ek.kanji IS NOT NULL) as kanji_forms,
        ARRAY_AGG(DISTINCT er.reading) FILTER (WHERE er.reading IS NOT NULL) as readings,
        ARRAY(
          SELECT sg.gloss
          FROM entry_senses es_inner
          JOIN sense_glosses sg ON es_inner.id = sg.sense_id
          WHERE es_inner.entry_id = de.id
          ORDER BY es_inner.sense_order, sg.gloss_order
        ) as glosses,
        ARRAY(
          SELECT DISTINCT pos
          FROM entry_senses es2, unnest(es2.parts_of_speech) pos
          WHERE es2.entry_id = de.id
        ) as parts_of_speech,
        BOOL_OR(COALESCE(ek.is_common, false) OR COALESCE(er.is_common, false)) as is_common,
        -- Compute frequency score (lower = more common)
        -- nf* tags: nf01 (most common) to nf48 (less common)
        -- Other priority tags get higher scores
        MIN(
          CASE 
            -- Extract nf* number if present (nf01 -> 1, nf48 -> 48)
            WHEN tag ~ '^nf[0-9]{2}$' THEN SUBSTRING(tag FROM 3)::INTEGER
            -- High priority non-nf tags
            WHEN tag IN ('news1', 'ichi1', 'spec1', 'gai1') THEN 50
            WHEN tag IN ('news2', 'ichi2', 'spec2', 'gai2') THEN 100
            -- No priority tag
            ELSE 999
          END
        ) as frequency_score
      FROM dictionary_entries de
      LEFT JOIN entry_kanji ek ON de.id = ek.entry_id
      LEFT JOIN entry_readings er ON de.id = er.entry_id
      LEFT JOIN entry_senses es ON de.id = es.entry_id
      LEFT JOIN sense_glosses sg ON es.id = sg.sense_id
      LEFT JOIN LATERAL (
        SELECT unnest(COALESCE(ek.priority_tags, ARRAY[]::text[]) || COALESCE(er.priority_tags, ARRAY[]::text[])) as tag
      ) tags ON true
    `;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`(
        ek.kanji ILIKE $${paramCount} OR 
        er.reading ILIKE $${paramCount} OR 
        sg.gloss ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      GROUP BY de.id, de.entry_id
      ORDER BY frequency_score ASC, is_common DESC, de.entry_id
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);
    
    res.json({
      words: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching words:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/words/:id - Get a single dictionary entry by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        de.id,
        de.entry_id,
        ARRAY_AGG(DISTINCT ek.kanji) FILTER (WHERE ek.kanji IS NOT NULL) as kanji_forms,
        ARRAY_AGG(DISTINCT er.reading) FILTER (WHERE er.reading IS NOT NULL) as readings,
        ARRAY(
          SELECT sg.gloss
          FROM entry_senses es_inner
          JOIN sense_glosses sg ON es_inner.id = sg.sense_id
          WHERE es_inner.entry_id = de.id
          ORDER BY es_inner.sense_order, sg.gloss_order
        ) as glosses,
        ARRAY(
          SELECT DISTINCT pos
          FROM entry_senses es2, unnest(es2.parts_of_speech) pos
          WHERE es2.entry_id = de.id
        ) as parts_of_speech,
        BOOL_OR(COALESCE(ek.is_common, false) OR COALESCE(er.is_common, false)) as is_common,
        MIN(
          CASE 
            WHEN tag ~ '^nf[0-9]{2}$' THEN SUBSTRING(tag FROM 3)::INTEGER
            WHEN tag IN ('news1', 'ichi1', 'spec1', 'gai1') THEN 50
            WHEN tag IN ('news2', 'ichi2', 'spec2', 'gai2') THEN 100
            ELSE 999
          END
        ) as frequency_score
      FROM dictionary_entries de
      LEFT JOIN entry_kanji ek ON de.id = ek.entry_id
      LEFT JOIN entry_readings er ON de.id = er.entry_id
      LEFT JOIN entry_senses es ON de.id = es.entry_id
      LEFT JOIN sense_glosses sg ON es.id = sg.sense_id
      LEFT JOIN LATERAL (
        SELECT unnest(COALESCE(ek.priority_tags, ARRAY[]::text[]) || COALESCE(er.priority_tags, ARRAY[]::text[])) as tag
      ) tags ON true
      WHERE de.id = $1
      GROUP BY de.id, de.entry_id
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching word:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// GET /api/words - Get dictionary entries with optional search
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, limit = 50, offset = 0, in_resources } = req.query;
    const userId = req.user?.userId;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    let exactSearchParam = 0;
    let partialSearchParam = 0;
    let userIdParam = 0;

    if (search) {
      partialSearchParam = paramCount;
      values.push(`%${search}%`);
      paramCount++;
      
      exactSearchParam = paramCount;
      values.push(search as string);
      paramCount++;
    }

    // Add user filter for in_resources
    if (in_resources === 'true' && userId) {
      userIdParam = paramCount;
      values.push(userId);
      paramCount++;
    }

    let query = `
      WITH matched_entries AS (
        SELECT DISTINCT de.id
        FROM dictionary_entries de
        LEFT JOIN entry_kanji ek ON de.id = ek.entry_id
        LEFT JOIN entry_readings er ON de.id = er.entry_id
        LEFT JOIN entry_senses es ON de.id = es.entry_id
        LEFT JOIN sense_glosses sg ON es.id = sg.sense_id
        ${in_resources === 'true' && userId ? `
        INNER JOIN resource_words rw ON de.id = rw.entry_id
        INNER JOIN resources r ON rw.resource_id = r.id
        ` : ''}
        WHERE 1=1
        ${in_resources === 'true' && userId ? `AND r.user_id = $${userIdParam}` : ''}
        ${search ? `AND (
          ek.kanji ILIKE $${partialSearchParam} OR 
          er.reading ILIKE $${partialSearchParam} OR 
          sg.gloss ILIKE $${partialSearchParam}
        )` : ''}
      )
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
        ) as frequency_score,
        ${search ? `
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM entry_kanji ek2 
            WHERE ek2.entry_id = de.id AND ek2.kanji = $${exactSearchParam}
          ) OR EXISTS (
            SELECT 1 FROM entry_readings er2 
            WHERE er2.entry_id = de.id AND er2.reading = $${exactSearchParam}
          ) OR EXISTS (
            SELECT 1 FROM entry_senses es3
            JOIN sense_glosses sg2 ON es3.id = sg2.sense_id
            WHERE es3.entry_id = de.id AND LOWER(sg2.gloss) = LOWER($${exactSearchParam})
          ) THEN 0
          ELSE 1
        END as match_type
        ` : '1 as match_type'}
      FROM matched_entries me
      JOIN dictionary_entries de ON me.id = de.id
      LEFT JOIN entry_kanji ek ON de.id = ek.entry_id
      LEFT JOIN entry_readings er ON de.id = er.entry_id
      LEFT JOIN entry_senses es ON de.id = es.entry_id
      LEFT JOIN sense_glosses sg ON es.id = sg.sense_id
      LEFT JOIN LATERAL (
        SELECT unnest(COALESCE(ek.priority_tags, ARRAY[]::text[]) || COALESCE(er.priority_tags, ARRAY[]::text[])) as tag
      ) tags ON true
      GROUP BY de.id, de.entry_id
      ORDER BY match_type ASC, frequency_score ASC, is_common DESC, de.entry_id
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


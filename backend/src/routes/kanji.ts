import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// GET /api/kanji - Get all kanji with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { grade, jlpt, search, limit = 50, offset = 0 } = req.query;

    let query = `
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
        ARRAY_AGG(km.meaning ORDER BY km.meaning_order) as meanings
      FROM kanji k
      LEFT JOIN kanji_meanings km ON k.id = km.kanji_id
    `;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (search) {
      // Search in literal (character), meanings, and readings
      conditions.push(`(
        k.literal = $${paramCount} OR 
        km.meaning ILIKE $${paramCount + 1} OR
        EXISTS (
          SELECT 1 FROM unnest(k.on_readings) as reading 
          WHERE reading ILIKE $${paramCount + 1}
        ) OR
        EXISTS (
          SELECT 1 FROM unnest(k.kun_readings) as reading 
          WHERE reading ILIKE $${paramCount + 1}
        )
      )`);
      values.push(search as string, `%${search}%`);
      paramCount += 2;
    }

    if (grade) {
      conditions.push(`k.grade = $${paramCount++}`);
      values.push(grade);
    }

    if (jlpt) {
      conditions.push(`k.jlpt_level = $${paramCount++}`);
      values.push(jlpt);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      GROUP BY k.id
      ORDER BY k.frequency_rank NULLS LAST
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);
    
    res.json({
      kanji: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching kanji:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/kanji/:id - Get a single kanji by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
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
        ARRAY_AGG(km.meaning ORDER BY km.meaning_order) as meanings
      FROM kanji k
      LEFT JOIN kanji_meanings km ON k.id = km.kanji_id
      WHERE k.id = $1
      GROUP BY k.id
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kanji not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching kanji:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


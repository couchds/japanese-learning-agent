import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/user-knowledge - Get all knowledge entries for user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { item_type, item_id } = req.query;

    const where: any = { user_id: userId };
    if (item_type) where.item_type = item_type as string;
    if (item_id) where.item_id = parseInt(item_id as string);

    const knowledge = await prisma.user_knowledge.findMany({
      where,
      orderBy: { updated_at: 'desc' },
    });

    res.json({ knowledge });
  } catch (error: any) {
    console.error('Error fetching user knowledge:', error);
    res.status(500).json({ error: 'Failed to fetch user knowledge' });
  }
});

// GET /api/user-knowledge/:itemType/:itemId - Get knowledge for specific item
router.get('/:itemType/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { itemType, itemId } = req.params;

    const knowledge = await prisma.user_knowledge.findFirst({
      where: {
        user_id: userId,
        item_type: itemType,
        item_id: parseInt(itemId),
      },
    });

    // Also fetch the actual item details
    let itemDetails = null;
    if (itemType === 'kanji') {
      itemDetails = await prisma.kanji.findUnique({
        where: { id: parseInt(itemId) },
        include: {
          kanji_meanings: {
            orderBy: { meaning_order: 'asc' },
          },
        },
      });
    } else if (itemType === 'vocabulary') {
      itemDetails = await prisma.dictionary_entries.findUnique({
        where: { id: parseInt(itemId) },
        include: {
          entry_kanji: true,
          entry_readings: true,
          entry_senses: {
            include: {
              sense_glosses: true,
            },
            take: 5,
          },
        },
      });
    }

    res.json({ knowledge, itemDetails });
  } catch (error: any) {
    console.error('Error fetching knowledge entry:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge entry' });
  }
});

// POST /api/user-knowledge - Create or update knowledge entry
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { item_type, item_id, proficiency_level, notes } = req.body;

    if (!item_type || !item_id) {
      return res.status(400).json({ error: 'item_type and item_id are required' });
    }

    // Check if already exists
    const existing = await prisma.user_knowledge.findFirst({
      where: {
        user_id: userId,
        item_type,
        item_id: parseInt(item_id),
      },
    });

    let knowledge;
    if (existing) {
      // Update
      knowledge = await prisma.user_knowledge.update({
        where: { id: existing.id },
        data: {
          proficiency_level: proficiency_level !== undefined ? parseInt(proficiency_level) : undefined,
          notes: notes !== undefined ? notes : undefined,
          updated_at: new Date(),
        },
      });
    } else {
      // Create
      knowledge = await prisma.user_knowledge.create({
        data: {
          user_id: userId,
          item_type,
          item_id: parseInt(item_id),
          proficiency_level: proficiency_level !== undefined ? parseInt(proficiency_level) : 0,
          notes: notes || null,
        },
      });
    }

    res.status(201).json(knowledge);
  } catch (error: any) {
    console.error('Error creating/updating knowledge:', error);
    res.status(500).json({ error: 'Failed to save knowledge entry' });
  }
});

// PATCH /api/user-knowledge/:itemType/:itemId - Update knowledge entry
router.patch('/:itemType/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { itemType, itemId } = req.params;
    const { proficiency_level, notes, review_count, correct_count, incorrect_count } = req.body;

    const updateData: any = {
      updated_at: new Date(),
    };

    if (proficiency_level !== undefined) updateData.proficiency_level = parseInt(proficiency_level);
    if (notes !== undefined) updateData.notes = notes;
    if (review_count !== undefined) updateData.review_count = parseInt(review_count);
    if (correct_count !== undefined) updateData.correct_count = parseInt(correct_count);
    if (incorrect_count !== undefined) updateData.incorrect_count = parseInt(incorrect_count);

    // Find the knowledge entry first
    const existing = await prisma.user_knowledge.findFirst({
      where: {
        user_id: userId,
        item_type: itemType,
        item_id: parseInt(itemId),
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    const knowledge = await prisma.user_knowledge.update({
      where: { id: existing.id },
      data: updateData,
    });

    res.json(knowledge);
  } catch (error: any) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({ error: 'Failed to update knowledge entry' });
  }
});

// DELETE /api/user-knowledge/:itemType/:itemId - Delete knowledge entry
router.delete('/:itemType/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { itemType, itemId } = req.params;

    // Find the knowledge entry first
    const existing = await prisma.user_knowledge.findFirst({
      where: {
        user_id: userId,
        item_type: itemType,
        item_id: parseInt(itemId),
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    await prisma.user_knowledge.delete({
      where: { id: existing.id },
    });

    res.json({ message: 'Knowledge entry deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ error: 'Failed to delete knowledge entry' });
  }
});

export default router;


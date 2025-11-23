import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/dashboard/stats - Get user learning statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get counts by proficiency level
    const proficiencyStats = await prisma.user_knowledge.groupBy({
      by: ['proficiency_level'],
      where: { user_id: userId },
      _count: { id: true },
    });

    // Get counts by item type
    const typeStats = await prisma.user_knowledge.groupBy({
      by: ['item_type'],
      where: { user_id: userId },
      _count: { id: true },
    });

    // Get recent items (last updated)
    const recentItems = await prisma.user_knowledge.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' },
      take: 10,
    });

    // Get items to review (if next_review is set and in the past)
    const itemsToReview = await prisma.user_knowledge.count({
      where: {
        user_id: userId,
        next_review: {
          lte: new Date(),
        },
      },
    });

    // Total counts
    const totalItems = await prisma.user_knowledge.count({
      where: { user_id: userId },
    });

    // Calculate accuracy
    const accuracyData = await prisma.user_knowledge.aggregate({
      where: {
        user_id: userId,
        review_count: { gt: 0 },
      },
      _sum: {
        correct_count: true,
        incorrect_count: true,
      },
    });

    const totalCorrect = accuracyData._sum.correct_count || 0;
    const totalIncorrect = accuracyData._sum.incorrect_count || 0;
    const totalReviews = totalCorrect + totalIncorrect;
    const accuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

    // Get JLPT statistics
    const jlptStats = await getJLPTStats(userId);

    res.json({
      proficiencyStats: proficiencyStats.map(stat => ({
        level: stat.proficiency_level,
        count: stat._count.id,
      })),
      typeStats: typeStats.map(stat => ({
        type: stat.item_type,
        count: stat._count.id,
      })),
      recentItems,
      itemsToReview,
      totalItems,
      accuracy: Math.round(accuracy),
      totalReviews,
      jlptStats,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Helper function to get JLPT statistics
async function getJLPTStats(userId: number) {
  const stats: any = {
    N5: { total: 0, learning: 0, mastered: 0, notStarted: 0 },
    N4: { total: 0, learning: 0, mastered: 0, notStarted: 0 },
    N3: { total: 0, learning: 0, mastered: 0, notStarted: 0 },
    N2: { total: 0, learning: 0, mastered: 0, notStarted: 0 },
    N1: { total: 0, learning: 0, mastered: 0, notStarted: 0 },
  };

  // Get tracked kanji with JLPT levels
  const trackedKanji = await prisma.user_knowledge.findMany({
    where: {
      user_id: userId,
      item_type: 'kanji',
    },
    include: {
      users: false,
    },
  });

  // Get all kanji with JLPT levels to find what's not started
  // Note: In the database, jlpt_level 1 = N1 (hardest), 5 = N5 (easiest)
  for (let level = 1; level <= 5; level++) {
    const jlptKey = `N${level}` as keyof typeof stats;
    
    // Total kanji at this JLPT level
    const totalKanji = await prisma.kanji.count({
      where: { jlpt_level: level },
    });
    stats[jlptKey].total = totalKanji;

    // Tracked kanji at this level
    for (const item of trackedKanji) {
      const kanji = await prisma.kanji.findUnique({
        where: { id: item.item_id || 0 },
        select: { jlpt_level: true },
      });

      if (kanji?.jlpt_level === level) {
        if (item.proficiency_level >= 3) {
          stats[jlptKey].mastered++;
        } else if (item.proficiency_level >= 1) {
          stats[jlptKey].learning++;
        }
      }
    }

    stats[jlptKey].notStarted = stats[jlptKey].total - stats[jlptKey].learning - stats[jlptKey].mastered;
  }

  return stats;
}

// GET /api/dashboard/items - Get items filtered by proficiency or type
router.get('/items', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { proficiency_level, item_type, limit = '50' } = req.query;

    const where: any = { user_id: userId };
    if (proficiency_level !== undefined) {
      where.proficiency_level = parseInt(proficiency_level as string);
    }
    if (item_type) {
      where.item_type = item_type as string;
    }

    const items = await prisma.user_knowledge.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: parseInt(limit as string),
    });

    // Fetch details for each item
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        let details = null;

        if (item.item_type === 'kanji' && item.item_id) {
          details = await prisma.kanji.findUnique({
            where: { id: item.item_id },
            select: {
              literal: true,
              kanji_meanings: {
                select: { meaning: true },
                orderBy: { meaning_order: 'asc' },
                take: 3,
              },
            },
          });
        } else if (item.item_type === 'vocabulary' && item.item_id) {
          details = await prisma.dictionary_entries.findUnique({
            where: { id: item.item_id },
            select: {
              entry_kanji: {
                select: { kanji: true },
                take: 1,
              },
              entry_readings: {
                select: { reading: true },
                take: 1,
              },
              entry_senses: {
                select: {
                  sense_glosses: {
                    select: { gloss: true },
                    take: 2,
                  },
                },
                take: 1,
              },
            },
          });
        }

        return {
          ...item,
          details,
        };
      })
    );

    res.json({ items: itemsWithDetails });
  } catch (error: any) {
    console.error('Error fetching dashboard items:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard items' });
  }
});

export default router;


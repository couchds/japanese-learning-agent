import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { upload } from '../config/multer';

const router = Router();

// GET /api/resources - Get all resources for the authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const resources = await prisma.resources.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    res.json({ resources });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resources/:id - Get a single resource with associated kanji and words
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const resource = await prisma.resources.findFirst({
      where: {
        id: resourceId,
        user_id: userId
      },
      include: {
        resource_kanji: {
          include: {
            kanji: {
              include: {
                kanji_meanings: true
              }
            }
          },
          orderBy: { frequency: 'desc' }
        },
        resource_words: {
          include: {
            dictionary_entries: {
              include: {
                entry_kanji: true,
                entry_readings: true,
                entry_senses: {
                  include: {
                    sense_glosses: true
                  }
                }
              }
            }
          },
          orderBy: { frequency: 'desc' }
        },
        custom_vocabulary: {
          orderBy: { frequency: 'desc' }
        }
      }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(resource);
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/resources - Create a new resource
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, type, status, description, difficulty_level, tags } = req.body;

    // Validation
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const validTypes = ['book', 'manga', 'video_game', 'news_article', 'anime', 'podcast', 'website'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // Handle uploaded file
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const resource = await prisma.resources.create({
      data: {
        user_id: userId,
        name,
        type,
        status: status || 'not_started',
        description,
        difficulty_level,
        tags: tags ? JSON.parse(tags) : [],
        image_path: imagePath
      }
    });

    res.status(201).json(resource);
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id - Update a resource
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, type, status, description, difficulty_level, tags, image_path } = req.body;

    // Check if resource exists and belongs to user
    const existing = await prisma.resources.findFirst({
      where: {
        id: resourceId,
        user_id: userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['book', 'manga', 'video_game', 'news_article', 'anime', 'podcast', 'website'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }
    }

    const resource = await prisma.resources.update({
      where: { id: resourceId },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(status && { status }),
        ...(description !== undefined && { description }),
        ...(difficulty_level !== undefined && { difficulty_level }),
        ...(tags !== undefined && { tags }),
        ...(image_path !== undefined && { image_path })
      }
    });

    res.json(resource);
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id - Delete a resource
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if resource exists and belongs to user
    const existing = await prisma.resources.findFirst({
      where: {
        id: resourceId,
        user_id: userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await prisma.resources.delete({
      where: { id: resourceId }
    });

    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== KANJI MANAGEMENT =====

// POST /api/resources/:id/kanji - Add kanji to a resource
router.post('/:id/kanji', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const { kanji_id, frequency, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Add or update kanji association
    const resourceKanji = await prisma.resource_kanji.upsert({
      where: {
        resource_id_kanji_id: {
          resource_id: resourceId,
          kanji_id: kanji_id
        }
      },
      update: {
        frequency: frequency || 0,
        notes: notes
      },
      create: {
        resource_id: resourceId,
        kanji_id: kanji_id,
        frequency: frequency || 0,
        notes: notes
      },
      include: {
        kanji: {
          include: {
            kanji_meanings: true
          }
        }
      }
    });

    res.status(201).json(resourceKanji);
  } catch (error) {
    console.error('Error adding kanji to resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id/kanji/:kanjiId - Update kanji frequency/notes
router.put('/:id/kanji/:kanjiId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const kanjiId = parseInt(req.params.kanjiId);
    const { frequency, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const updated = await prisma.resource_kanji.update({
      where: {
        resource_id_kanji_id: {
          resource_id: resourceId,
          kanji_id: kanjiId
        }
      },
      data: {
        frequency: frequency,
        notes: notes
      },
      include: {
        kanji: {
          include: {
            kanji_meanings: true
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating kanji:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id/kanji/:kanjiId - Remove kanji from resource
router.delete('/:id/kanji/:kanjiId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const kanjiId = parseInt(req.params.kanjiId);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await prisma.resource_kanji.delete({
      where: {
        resource_id_kanji_id: {
          resource_id: resourceId,
          kanji_id: kanjiId
        }
      }
    });

    res.json({ message: 'Kanji removed from resource' });
  } catch (error) {
    console.error('Error removing kanji:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== WORDS MANAGEMENT =====

// POST /api/resources/:id/words - Add word to a resource
router.post('/:id/words', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const { entry_id, frequency, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Add or update word association
    const resourceWord = await prisma.resource_words.upsert({
      where: {
        resource_id_entry_id: {
          resource_id: resourceId,
          entry_id: entry_id
        }
      },
      update: {
        frequency: frequency || 0,
        notes: notes
      },
      create: {
        resource_id: resourceId,
        entry_id: entry_id,
        frequency: frequency || 0,
        notes: notes
      },
      include: {
        dictionary_entries: true
      }
    });

    res.status(201).json(resourceWord);
  } catch (error) {
    console.error('Error adding word to resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id/words/:entryId - Update word frequency/notes
router.put('/:id/words/:entryId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const entryId = parseInt(req.params.entryId);
    const { frequency, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const updated = await prisma.resource_words.update({
      where: {
        resource_id_entry_id: {
          resource_id: resourceId,
          entry_id: entryId
        }
      },
      data: {
        frequency: frequency,
        notes: notes
      },
      include: {
        dictionary_entries: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating word:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id/words/:entryId - Remove word from resource
router.delete('/:id/words/:entryId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const entryId = parseInt(req.params.entryId);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await prisma.resource_words.delete({
      where: {
        resource_id_entry_id: {
          resource_id: resourceId,
          entry_id: entryId
        }
      }
    });

    res.json({ message: 'Word removed from resource' });
  } catch (error) {
    console.error('Error removing word:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/resources/:id/custom-words - Add custom word to resource
router.post('/:id/custom-words', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const { word, reading, meaning, frequency } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Check if custom word already exists
    const existing = await prisma.custom_vocabulary.findUnique({
      where: {
        resource_id_word: {
          resource_id: resourceId,
          word: word
        }
      }
    });

    if (existing) {
      // Update frequency if it exists
      const updated = await prisma.custom_vocabulary.update({
        where: {
          resource_id_word: {
            resource_id: resourceId,
            word: word
          }
        },
        data: {
          frequency: existing.frequency + 1
        }
      });
      return res.json(updated);
    }

    // Create new custom word
    const customWord = await prisma.custom_vocabulary.create({
      data: {
        resource_id: resourceId,
        word: word,
        reading: reading || null,
        meaning: meaning || null,
        frequency: frequency || 1
      }
    });

    res.status(201).json(customWord);
  } catch (error) {
    console.error('Error adding custom word:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id/custom-words/:wordId - Update custom word
router.put('/:id/custom-words/:wordId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const wordId = parseInt(req.params.wordId);
    const { frequency, reading, meaning, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const updated = await prisma.custom_vocabulary.update({
      where: {
        id: wordId,
        resource_id: resourceId
      },
      data: {
        frequency: frequency,
        reading: reading,
        meaning: meaning,
        notes: notes
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating custom word:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id/custom-words/:wordId - Remove custom word from resource
router.delete('/:id/custom-words/:wordId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const resourceId = parseInt(req.params.id);
    const wordId = parseInt(req.params.wordId);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify resource belongs to user
    const resource = await prisma.resources.findFirst({
      where: { id: resourceId, user_id: userId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await prisma.custom_vocabulary.delete({
      where: {
        id: wordId,
        resource_id: resourceId
      }
    });

    res.json({ message: 'Custom word removed from resource' });
  } catch (error) {
    console.error('Error removing custom word:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


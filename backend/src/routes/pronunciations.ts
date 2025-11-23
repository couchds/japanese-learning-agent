import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { audioUpload, uploadAudioToStorage } from '../config/audioUpload';

const router = Router();

// POST /api/pronunciations - Upload a pronunciation recording
router.post('/', audioUpload.single('audio'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { entry_id, is_reference, duration_ms, notes } = req.body;

    // Validation
    if (!entry_id) {
      return res.status(400).json({ error: 'entry_id is required' });
    }

    // Verify entry exists
    const entry = await prisma.dictionary_entries.findUnique({
      where: { id: parseInt(entry_id) }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Dictionary entry not found' });
    }

    // Upload audio to storage and get URL
    const audioPath = await uploadAudioToStorage(req.file, userId);

    // Create pronunciation recording
    const recording = await prisma.pronunciation_recordings.create({
      data: {
        user_id: userId,
        entry_id: parseInt(entry_id),
        audio_path: audioPath,
        is_reference: is_reference === 'true' || is_reference === true,
        duration_ms: duration_ms ? parseInt(duration_ms) : null,
        notes: notes || null
      },
      include: {
        dictionary_entries: {
          include: {
            entry_kanji: true,
            entry_readings: true
          }
        }
      }
    });

    res.status(201).json(recording);
  } catch (error) {
    console.error('Error uploading pronunciation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pronunciations - Get pronunciation recordings
// Query params: entry_id (optional), is_reference (optional)
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { entry_id, is_reference } = req.query;

    const where: any = {
      user_id: userId
    };

    if (entry_id) {
      where.entry_id = parseInt(entry_id as string);
    }

    if (is_reference !== undefined) {
      where.is_reference = is_reference === 'true';
    }

    const recordings = await prisma.pronunciation_recordings.findMany({
      where,
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
      orderBy: { created_at: 'desc' }
    });

    res.json({ recordings });
  } catch (error) {
    console.error('Error fetching pronunciations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pronunciations/:id - Get a single pronunciation recording
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const recordingId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const recording = await prisma.pronunciation_recordings.findFirst({
      where: {
        id: recordingId,
        user_id: userId
      },
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
      }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.json(recording);
  } catch (error) {
    console.error('Error fetching pronunciation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/pronunciations/:id - Update a pronunciation recording (metadata only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const recordingId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { is_reference, notes } = req.body;

    // Check if recording exists and belongs to user
    const existing = await prisma.pronunciation_recordings.findFirst({
      where: {
        id: recordingId,
        user_id: userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const updated = await prisma.pronunciation_recordings.update({
      where: { id: recordingId },
      data: {
        ...(is_reference !== undefined && { is_reference }),
        ...(notes !== undefined && { notes })
      },
      include: {
        dictionary_entries: {
          include: {
            entry_kanji: true,
            entry_readings: true
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating pronunciation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/pronunciations/:id - Delete a pronunciation recording
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const recordingId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if recording exists and belongs to user
    const existing = await prisma.pronunciation_recordings.findFirst({
      where: {
        id: recordingId,
        user_id: userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Note: Files in cloud storage are managed by lifecycle rules; local files remain on disk
    // Delete from database
    await prisma.pronunciation_recordings.delete({
      where: { id: recordingId }
    });

    res.json({ message: 'Recording deleted successfully' });
  } catch (error) {
    console.error('Error deleting pronunciation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


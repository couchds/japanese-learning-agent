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

// GET /api/resources/:id - Get a single resource
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

export default router;


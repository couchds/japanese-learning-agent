import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { upload, uploadToStorage } from '../config/multer';

const router = Router();

// POST /api/resource-images - Upload an image and link to a resource
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { resource_id, notes } = req.body;

    // Validation
    if (!resource_id) {
      return res.status(400).json({ error: 'resource_id is required' });
    }

    // Verify resource exists and belongs to user
    const resource = await prisma.resources.findFirst({
      where: {
        id: parseInt(resource_id),
        user_id: userId
      }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found or access denied' });
    }

    // Upload image to storage
    const imagePath = await uploadToStorage(req.file, userId);

    // Create resource_image entry
    const resourceImage = await prisma.resource_images.create({
      data: {
        resource_id: parseInt(resource_id),
        user_id: userId,
        image_path: imagePath,
        notes: notes || null
      },
      include: {
        resources: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    res.status(201).json(resourceImage);
  } catch (error) {
    console.error('Error uploading resource image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resource-images - Get all resource images for authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { resource_id } = req.query;

    const where: any = {
      user_id: userId
    };

    if (resource_id) {
      where.resource_id = parseInt(resource_id as string);
    }

    const images = await prisma.resource_images.findMany({
      where,
      include: {
        resources: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ images });
  } catch (error) {
    console.error('Error fetching resource images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resource-images/:id - Get a single resource image
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const imageId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const image = await prisma.resource_images.findFirst({
      where: {
        id: imageId,
        user_id: userId
      },
      include: {
        resources: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true
          }
        }
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    console.error('Error fetching resource image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resource-images/:id - Delete a resource image
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const imageId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if image exists and belongs to user
    const existing = await prisma.resource_images.findFirst({
      where: {
        id: imageId,
        user_id: userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Image not found' });
    }

    await prisma.resource_images.delete({
      where: { id: imageId }
    });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting resource image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


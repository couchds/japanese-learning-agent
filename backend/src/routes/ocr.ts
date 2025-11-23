import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { processImageOCR, checkOCRServiceHealth } from '../services/ocrService';
import path from 'path';

const router = Router();

// POST /api/ocr/process/:imageId - Process OCR for a resource image (manual trigger)
router.post('/process/:imageId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const imageId = parseInt(req.params.imageId);
    const force = req.query.force === 'true';

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (isNaN(imageId)) {
      return res.status(400).json({ error: 'Invalid image ID' });
    }

    // Get the resource image
    const resourceImage = await prisma.resource_images.findFirst({
      where: {
        id: imageId,
        user_id: userId, // Ensure user owns this image
      },
    });

    if (!resourceImage) {
      return res.status(404).json({ error: 'Resource image not found' });
    }

    // Check if already processed
    if (resourceImage.ocr_processed && !force) {
      return res.status(400).json({ 
        error: 'Image already processed',
        message: 'Use force=true to reprocess'
      });
    }

    // Check storage type
    if (process.env.USE_GCS === 'true') {
      return res.status(501).json({ 
        error: 'GCS OCR not yet implemented',
        message: 'Please use local storage for OCR processing'
      });
    }

    // If forcing reprocess, delete existing elements
    if (force && resourceImage.ocr_processed) {
      await prisma.ocr_elements.deleteMany({
        where: { resource_image_id: imageId }
      });
      await prisma.resource_images.update({
        where: { id: imageId },
        data: { ocr_processed: false }
      });
    }

    // Process OCR
    await processImageOCR(imageId, resourceImage.image_path);

    // Get results
    const elements = await prisma.ocr_elements.findMany({
      where: { resource_image_id: imageId }
    });

    const updated = await prisma.resource_images.findUnique({
      where: { id: imageId }
    });

    const matched = elements.filter(e => e.item_id !== null).length;
    const unmatched = elements.length - matched;

    res.json({
      message: 'OCR processing completed',
      raw_text: updated?.ocr_raw_text,
      total_elements: elements.length,
      matched_elements: matched,
      unmatched_elements: unmatched,
      elements: elements.map(e => ({
        text: e.text,
        type: e.element_type,
        matched: e.item_id !== null,
      })),
    });
  } catch (error: any) {
    console.error('OCR processing error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'OCR service unavailable',
        message: 'Please ensure the OCR service is running on port 5001'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to process OCR',
      details: error.message 
    });
  }
});

// GET /api/ocr/elements/:imageId - Get OCR elements for an image
router.get('/elements/:imageId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const imageId = parseInt(req.params.imageId);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user owns this image
    const resourceImage = await prisma.resource_images.findFirst({
      where: {
        id: imageId,
        user_id: userId,
      },
    });

    if (!resourceImage) {
      return res.status(404).json({ error: 'Resource image not found' });
    }

    // Get OCR elements with related data
    const elements = await prisma.ocr_elements.findMany({
      where: { resource_image_id: imageId },
      orderBy: { id: 'asc' },
    });

    // Enhance elements with dictionary/kanji data
    const enrichedElements = await Promise.all(
      elements.map(async (element) => {
        let details = null;

        if (element.item_id) {
          if (element.element_type === 'kanji') {
            details = await prisma.kanji.findUnique({
              where: { id: element.item_id },
              select: {
                literal: true,
                on_readings: true,
                kun_readings: true,
                kanji_meanings: {
                  select: {
                    meaning: true,
                  },
                  orderBy: {
                    meaning_order: 'asc',
                  },
                },
              },
            });
          } else if (element.element_type === 'vocabulary') {
            details = await prisma.dictionary_entries.findUnique({
              where: { id: element.item_id },
              select: {
                entry_kanji: {
                  select: {
                    kanji: true,
                  },
                },
                entry_readings: {
                  select: {
                    reading: true,
                  },
                },
                entry_senses: {
                  select: {
                    sense_glosses: {
                      select: {
                        gloss: true,
                      },
                    },
                  },
                  take: 3, // Limit to first 3 senses
                },
              },
            });
          }
        }

        return {
          ...element,
          details,
        };
      })
    );

    res.json({
      image_id: imageId,
      ocr_processed: resourceImage.ocr_processed,
      raw_text: resourceImage.ocr_raw_text,
      elements: enrichedElements,
    });
  } catch (error: any) {
    console.error('Error fetching OCR elements:', error);
    res.status(500).json({ error: 'Failed to fetch OCR elements' });
  }
});

// GET /api/ocr/health - Check OCR service health
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await checkOCRServiceHealth();
    if (isHealthy) {
      res.json({
        ocr_service: 'online',
        url: process.env.OCR_SERVICE_URL || 'http://localhost:5001',
      });
    } else {
      res.status(503).json({
        ocr_service: 'offline',
        url: process.env.OCR_SERVICE_URL || 'http://localhost:5001',
        error: 'OCR service is not responding',
      });
    }
  } catch (error) {
    res.status(503).json({
      ocr_service: 'offline',
      url: process.env.OCR_SERVICE_URL || 'http://localhost:5001',
      error: 'OCR service is not responding',
    });
  }
});

export default router;


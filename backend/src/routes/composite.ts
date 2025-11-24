import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { analyzeDialogue, askAboutDialogue, isOpenAIAvailable } from '../services/openaiService';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Helper function to fetch previous dialogue context
 */
async function getPreviousDialogueContext(compositeId: number, userId: number): Promise<{ dialogue_text: string; translation: string }[]> {
  const previousDialogues: { dialogue_text: string; translation: string }[] = [];
  let currentCompositeId: number | null = compositeId;
  
  // Follow the chain backwards up to 5 previous dialogues
  for (let i = 0; i < 5 && currentCompositeId; i++) {
    const composite: {
      dialogue_text: string;
      translation: string | null;
      previous_composite_id: number | null;
    } | null = await prisma.ocr_composite.findFirst({
      where: {
        id: currentCompositeId,
        user_id: userId,
      },
      select: {
        dialogue_text: true,
        translation: true,
        previous_composite_id: true,
      },
    });

    if (!composite) break;

    if (composite.dialogue_text && composite.translation) {
      previousDialogues.unshift({
        dialogue_text: composite.dialogue_text,
        translation: composite.translation,
      });
    }

    currentCompositeId = composite.previous_composite_id;
  }

  return previousDialogues;
}

/**
 * POST /api/composite/analyze-text
 * Create and analyze a dialogue composite from raw text input
 */
router.post('/analyze-text', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { resourceImageId, text, previousCompositeId } = req.body;

    if (!resourceImageId || !text || !text.trim()) {
      return res.status(400).json({ error: 'resourceImageId and text required' });
    }

    // Check if OpenAI is configured
    if (!isOpenAIAvailable()) {
      return res.status(503).json({ 
        error: 'OpenAI service not configured',
        message: 'Please set OPENAI_API_KEY environment variable to enable dialogue analysis'
      });
    }

    // Verify resource image belongs to user
    const resourceImage = await prisma.resource_images.findFirst({
      where: {
        id: resourceImageId,
        user_id: userId,
      },
    });

    if (!resourceImage) {
      return res.status(404).json({ error: 'Resource image not found' });
    }

    const dialogueText = text.trim();

    // Fetch previous dialogue context if provided
    let previousDialogues: any[] = [];
    if (previousCompositeId) {
      previousDialogues = await getPreviousDialogueContext(previousCompositeId, userId);
      console.log(`[Composite] Found ${previousDialogues.length} previous dialogue(s) for context`);
    }

    console.log(`[Composite] Analyzing raw text for image ${resourceImageId}: "${dialogueText}"`);

    // Analyze dialogue with OpenAI (with context)
    let analysis;
    try {
      analysis = await analyzeDialogue(dialogueText, previousDialogues);
    } catch (error: any) {
      console.error('[Composite] OpenAI analysis failed:', error);
      return res.status(500).json({ 
        error: 'Failed to analyze dialogue',
        message: error.message 
      });
    }

    // Create composite record (without linking to OCR elements)
    const composite = await prisma.ocr_composite.create({
      data: {
        resource_image_id: resourceImageId,
        user_id: userId,
        previous_composite_id: previousCompositeId || null,
        dialogue_text: dialogueText,
        translation: analysis.translation,
        breakdown: analysis.breakdown as any,
        grammar_notes: analysis.grammar_notes,
        context_notes: analysis.context_notes,
        processed: true,
      },
    });

    console.log(`[Composite] Created composite ${composite.id} from raw text`);

    res.status(201).json(composite);
  } catch (error: any) {
    console.error('[Composite] Error:', error);
    res.status(500).json({ error: 'Failed to create composite', message: error.message });
  }
});

/**
 * POST /api/composite/analyze
 * Create and analyze a dialogue composite from selected OCR elements
 */
router.post('/analyze', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { resourceImageId, elementIds, previousCompositeId } = req.body;

    if (!resourceImageId || !Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ error: 'resourceImageId and elementIds array required' });
    }

    // Check if OpenAI is configured
    if (!isOpenAIAvailable()) {
      return res.status(503).json({ 
        error: 'OpenAI service not configured',
        message: 'Please set OPENAI_API_KEY environment variable to enable dialogue analysis'
      });
    }

    // Verify resource image belongs to user
    const resourceImage = await prisma.resource_images.findFirst({
      where: {
        id: resourceImageId,
        user_id: userId,
      },
    });

    if (!resourceImage) {
      return res.status(404).json({ error: 'Resource image not found' });
    }

    // Fetch all selected OCR elements
    const elements = await prisma.ocr_elements.findMany({
      where: {
        id: { in: elementIds },
        resource_image_id: resourceImageId,
      },
      orderBy: {
        position_y: 'asc', // Order by vertical position (top to bottom)
      },
    });

    if (elements.length === 0) {
      return res.status(404).json({ error: 'No OCR elements found' });
    }

    // Combine text from all elements
    const dialogueText = elements.map((el) => el.text).join('');

    // Fetch previous dialogue context if provided
    let previousDialogues: any[] = [];
    if (previousCompositeId) {
      previousDialogues = await getPreviousDialogueContext(previousCompositeId, userId);
      console.log(`[Composite] Found ${previousDialogues.length} previous dialogue(s) for context`);
    }

    console.log(`[Composite] Analyzing dialogue for image ${resourceImageId}: "${dialogueText}"`);

    // Analyze dialogue with OpenAI (with context)
    let analysis;
    try {
      analysis = await analyzeDialogue(dialogueText, previousDialogues);
    } catch (error: any) {
      console.error('[Composite] OpenAI analysis failed:', error);
      return res.status(500).json({ 
        error: 'Failed to analyze dialogue',
        message: error.message 
      });
    }

    // Create composite record
    const composite = await prisma.ocr_composite.create({
      data: {
        resource_image_id: resourceImageId,
        user_id: userId,
        previous_composite_id: previousCompositeId || null,
        dialogue_text: dialogueText,
        translation: analysis.translation,
        breakdown: analysis.breakdown as any, // Prisma Json type
        grammar_notes: analysis.grammar_notes,
        context_notes: analysis.context_notes,
        processed: true,
      },
    });

    // Link elements to this composite
    await prisma.ocr_elements.updateMany({
      where: {
        id: { in: elementIds },
      },
      data: {
        composite_id: composite.id,
      },
    });

    console.log(`[Composite] Created composite ${composite.id} with ${elements.length} elements`);

    res.status(201).json(composite);
  } catch (error: any) {
    console.error('[Composite] Error:', error);
    res.status(500).json({ error: 'Failed to create composite', message: error.message });
  }
});

/**
 * GET /api/composite/resource/:resourceId
 * Get all composites for a resource (across all images)
 */
router.get('/resource/:resourceId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const resourceId = parseInt(req.params.resourceId);

    if (isNaN(resourceId)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }

    // Fetch all composites for images in this resource
    const composites = await prisma.ocr_composite.findMany({
      where: {
        user_id: userId,
        resource_images: {
          resource_id: resourceId,
        },
      },
      include: {
        resource_images: {
          select: {
            id: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc', // Chronological order
      },
    });

    res.json(composites);
  } catch (error: any) {
    console.error('[Composite] Error fetching resource composites:', error);
    res.status(500).json({ error: 'Failed to fetch composites', message: error.message });
  }
});

/**
 * GET /api/composite/:imageId
 * Get all composites for a resource image
 */
router.get('/:imageId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const imageId = parseInt(req.params.imageId);

    if (isNaN(imageId)) {
      return res.status(400).json({ error: 'Invalid image ID' });
    }

    // Verify image belongs to user
    const resourceImage = await prisma.resource_images.findFirst({
      where: {
        id: imageId,
        user_id: userId,
      },
    });

    if (!resourceImage) {
      return res.status(404).json({ error: 'Resource image not found' });
    }

    // Fetch all composites for this image
    const composites = await prisma.ocr_composite.findMany({
      where: {
        resource_image_id: imageId,
        user_id: userId,
      },
      include: {
        ocr_elements: {
          select: {
            id: true,
            text: true,
            element_type: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.json(composites);
  } catch (error: any) {
    console.error('[Composite] Error fetching composites:', error);
    res.status(500).json({ error: 'Failed to fetch composites', message: error.message });
  }
});

/**
 * GET /api/composite/detail/:compositeId
 * Get a single composite with full details
 */
router.get('/detail/:compositeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const compositeId = parseInt(req.params.compositeId);

    if (isNaN(compositeId)) {
      return res.status(400).json({ error: 'Invalid composite ID' });
    }

    const composite = await prisma.ocr_composite.findFirst({
      where: {
        id: compositeId,
        user_id: userId,
      },
      include: {
        ocr_elements: {
          select: {
            id: true,
            text: true,
            element_type: true,
            position_x: true,
            position_y: true,
            width: true,
            height: true,
          },
          orderBy: {
            position_y: 'asc',
          },
        },
      },
    });

    if (!composite) {
      return res.status(404).json({ error: 'Composite not found' });
    }

    res.json(composite);
  } catch (error: any) {
    console.error('[Composite] Error fetching composite:', error);
    res.status(500).json({ error: 'Failed to fetch composite', message: error.message });
  }
});

/**
 * DELETE /api/composite/:compositeId
 * Delete a composite (and unlink its elements)
 */
router.delete('/:compositeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const compositeId = parseInt(req.params.compositeId);

    if (isNaN(compositeId)) {
      return res.status(400).json({ error: 'Invalid composite ID' });
    }

    // Verify composite belongs to user
    const composite = await prisma.ocr_composite.findFirst({
      where: {
        id: compositeId,
        user_id: userId,
      },
    });

    if (!composite) {
      return res.status(404).json({ error: 'Composite not found' });
    }

    // Unlink elements (set composite_id to null)
    await prisma.ocr_elements.updateMany({
      where: {
        composite_id: compositeId,
      },
      data: {
        composite_id: null,
      },
    });

    // Delete composite
    await prisma.ocr_composite.delete({
      where: {
        id: compositeId,
      },
    });

    console.log(`[Composite] Deleted composite ${compositeId}`);

    res.json({ message: 'Composite deleted successfully' });
  } catch (error: any) {
    console.error('[Composite] Error deleting composite:', error);
    res.status(500).json({ error: 'Failed to delete composite', message: error.message });
  }
});

/**
 * POST /api/composite/:compositeId/ask
 * Ask a follow-up question about a dialogue composite
 */
router.post('/:compositeId/ask', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const compositeId = parseInt(req.params.compositeId);
    const { question, chatHistory } = req.body;

    if (isNaN(compositeId) || !question || !question.trim()) {
      return res.status(400).json({ error: 'Invalid composite ID or question' });
    }

    // Check if OpenAI is configured
    if (!isOpenAIAvailable()) {
      return res.status(503).json({ 
        error: 'OpenAI service not configured',
        message: 'Please set OPENAI_API_KEY environment variable'
      });
    }

    // Verify composite belongs to user
    const composite = await prisma.ocr_composite.findFirst({
      where: {
        id: compositeId,
        user_id: userId,
      },
    });

    if (!composite) {
      return res.status(404).json({ error: 'Composite not found' });
    }

    console.log(`[Composite] User asking question about composite ${compositeId}`);

    try {
      const answer = await askAboutDialogue(
        composite.dialogue_text,
        composite.translation || '',
        composite.breakdown as any,
        composite.grammar_notes || '',
        composite.context_notes || '',
        question.trim(),
        chatHistory || []
      );

      res.json({ answer });
    } catch (error: any) {
      console.error('[Composite] Error answering question:', error);
      res.status(500).json({ 
        error: 'Failed to answer question',
        message: error.message 
      });
    }
  } catch (error: any) {
    console.error('[Composite] Error:', error);
    res.status(500).json({ error: 'Failed to process question', message: error.message });
  }
});

/**
 * POST /api/composite/ask-simple
 * Ask questions about Japanese text directly without creating a composite
 */
router.post('/ask-simple', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { japaneseText, question, chatHistory } = req.body;

    if (!japaneseText || !japaneseText.trim() || !question || !question.trim()) {
      return res.status(400).json({ error: 'Japanese text and question required' });
    }

    // Check if OpenAI is configured
    if (!isOpenAIAvailable()) {
      return res.status(503).json({ 
        error: 'OpenAI service not configured',
        message: 'Please set OPENAI_API_KEY environment variable'
      });
    }

    console.log(`[Composite] Simple question about text: "${japaneseText.substring(0, 50)}..."`);

    try {
      const answer = await askAboutDialogue(
        japaneseText.trim(),
        '', // No translation yet
        [], // No breakdown yet
        '', // No grammar notes yet
        '', // No context notes yet
        question.trim(),
        chatHistory || []
      );

      res.json({ answer });
    } catch (error: any) {
      console.error('[Composite] Error answering simple question:', error);
      res.status(500).json({ 
        error: 'Failed to answer question',
        message: error.message 
      });
    }
  } catch (error: any) {
    console.error('[Composite] Error:', error);
    res.status(500).json({ error: 'Failed to process question', message: error.message });
  }
});

/**
 * GET /api/composite/status
 * Check if OpenAI service is available
 */
router.get('/status', authenticateToken, async (_req: Request, res: Response) => {
  res.json({
    available: isOpenAIAvailable(),
    message: isOpenAIAvailable() 
      ? 'OpenAI service is ready' 
      : 'OpenAI API key not configured',
  });
});

export default router;


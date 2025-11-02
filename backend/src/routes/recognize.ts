import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const RECOGNITION_SERVICE_URL = process.env.RECOGNITION_SERVICE_URL || 'http://localhost:5000';

// POST /api/recognize - Recognize kanji from drawing
router.post('/', async (req: Request, res: Response) => {
  try {
    const { image, limit = 10 } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Missing image data'
      });
    }

    // Forward the request to the Python recognition service
    const response = await axios.post(`${RECOGNITION_SERVICE_URL}/recognize`, {
      image,
      limit
    }, {
      timeout: 10000 // 10 second timeout
    });

    res.json(response.data);
  } catch (err: any) {
    console.error('Recognition error:', err.message);
    
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Recognition service unavailable. Please ensure the Python service is running.'
      });
    }

    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to recognize kanji'
    });
  }
});

// GET /api/recognize/health - Check recognition service health
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RECOGNITION_SERVICE_URL}/health`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: 'Recognition service unavailable'
    });
  }
});

// GET /api/recognize/info - Get recognition service info
router.get('/info', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RECOGNITION_SERVICE_URL}/info`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (err) {
    res.status(503).json({
      error: 'Recognition service unavailable'
    });
  }
});

export default router;


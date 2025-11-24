import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import kanjiRoutes from './routes/kanji';
import wordsRoutes from './routes/words';
import authRoutes from './routes/auth';
import resourcesRoutes from './routes/resources';
import recognizeRoutes from './routes/recognize';
import transcriptionRoutes from './routes/transcription';
import pronunciationsRoutes from './routes/pronunciations';
import resourceImagesRoutes from './routes/resourceImages';
import ocrRoutes from './routes/ocr';
import userKnowledgeRoutes from './routes/userKnowledge';
import dashboardRoutes from './routes/dashboard';
import compositeRoutes from './routes/composite';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const USE_GCS = process.env.USE_GCS === 'true';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory if using local storage
if (!USE_GCS) {
  const uploadsPath = path.join(__dirname, '../uploads');
  app.use('/uploads', express.static(uploadsPath));
  console.log(`Serving local uploads from: ${uploadsPath}`);
}

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/kanji', authenticateToken, kanjiRoutes);
app.use('/api/words', authenticateToken, wordsRoutes);
app.use('/api/resources', authenticateToken, resourcesRoutes);
app.use('/api/recognize', authenticateToken, recognizeRoutes);
app.use('/api/transcribe', authenticateToken, transcriptionRoutes);
app.use('/api/pronunciations', authenticateToken, pronunciationsRoutes);
app.use('/api/resource-images', authenticateToken, resourceImagesRoutes);
app.use('/api/ocr', authenticateToken, ocrRoutes);
app.use('/api/user-knowledge', authenticateToken, userKnowledgeRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/composite', authenticateToken, compositeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});


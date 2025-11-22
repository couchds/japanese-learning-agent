import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import kanjiRoutes from './routes/kanji';
import wordsRoutes from './routes/words';
import authRoutes from './routes/auth';
import resourcesRoutes from './routes/resources';
import recognizeRoutes from './routes/recognize';
import transcriptionRoutes from './routes/transcription';
import pronunciationsRoutes from './routes/pronunciations';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/kanji', authenticateToken, kanjiRoutes);
app.use('/api/words', authenticateToken, wordsRoutes);
app.use('/api/resources', authenticateToken, resourcesRoutes);
app.use('/api/recognize', authenticateToken, recognizeRoutes);
app.use('/api/transcribe', authenticateToken, transcriptionRoutes);
app.use('/api/pronunciations', authenticateToken, pronunciationsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


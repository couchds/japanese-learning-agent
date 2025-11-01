import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import kanjiRoutes from './routes/kanji';
import wordsRoutes from './routes/words';
import authRoutes from './routes/auth';
import resourcesRoutes from './routes/resources';
import { authenticateToken } from './middleware/auth';

dotenv.config({ path: '../.env' });

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/kanji', authenticateToken, kanjiRoutes);
app.use('/api/words', authenticateToken, wordsRoutes);
app.use('/api/resources', authenticateToken, resourcesRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


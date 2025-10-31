import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import kanjiRoutes from './routes/kanji';

dotenv.config({ path: '../.env' });

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/kanji', kanjiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


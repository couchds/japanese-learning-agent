import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

// Create pronunciations directory if it doesn't exist
const pronunciationsDir = 'uploads/pronunciations';
if (!fs.existsSync(pronunciationsDir)) {
  fs.mkdirSync(pronunciationsDir, { recursive: true });
}

// Configure storage for audio files
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, pronunciationsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: userId-entryId-timestamp.ext
    const userId = (req as any).user?.userId || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${timestamp}${ext}`);
  }
});

// File filter - only allow audio files
const audioFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed (MP3, WAV, WebM, OGG, M4A).'));
  }
};

// Configure multer for audio uploads
export const audioUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size for audio
  },
  fileFilter: audioFileFilter
});


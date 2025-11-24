import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { Storage } from '@google-cloud/storage';

// Check if we should use GCS or local storage
const USE_GCS = process.env.USE_GCS === 'true';
const bucketName = process.env.GCS_BUCKET_NAME || 'japanese-learning-resources-couch-gcp-dev';
const UPLOADS_DIR = path.join(__dirname, '../../uploads/pronunciations');

// Initialize GCS client only if needed
let storage: Storage | null = null;
let bucket: any = null;

if (USE_GCS) {
  storage = new Storage();
  bucket = storage.bucket(bucketName);
  console.log('Using GCS for audio storage');
} else {
  // Ensure local uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  console.log('Using local disk for audio storage');
}

// Configure multer storage based on environment
const storageEngine = USE_GCS 
  ? multer.memoryStorage() 
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${req.user?.userId || 'unknown'}-${timestamp}${ext}`);
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
  storage: storageEngine,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size for audio
  },
  fileFilter: audioFileFilter
});

// Helper function to upload audio file (GCS or local)
export const uploadAudioToStorage = async (file: Express.Multer.File, userId: number | string): Promise<string> => {
  if (USE_GCS) {
    // Upload to GCS
  const timestamp = Date.now();
  const ext = path.extname(file.originalname);
  const filename = `pronunciations/${userId}-${timestamp}${ext}`;
  
  const blob = bucket.file(filename);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      contentType: file.mimetype,
    },
  });

  return new Promise((resolve, reject) => {
      blobStream.on('error', (err: Error) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      // Make the file publicly accessible
      blob.makePublic().then(() => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
        resolve(publicUrl);
      }).catch(reject);
    });

    blobStream.end(file.buffer);
  });
  } else {
    // File is already saved locally by multer diskStorage
    // Return relative URL path
    return `/uploads/pronunciations/${file.filename}`;
  }
};

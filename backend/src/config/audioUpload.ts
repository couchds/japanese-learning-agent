import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET_NAME || 'japanese-learning-resources-couch-gcp-dev';

// Initialize GCS client
const storage = new Storage();
const bucket = storage.bucket(bucketName);

// Configure multer to use memory storage
const memoryStorage = multer.memoryStorage();

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
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size for audio
  },
  fileFilter: audioFileFilter
});

// Helper function to upload audio file to GCS
export const uploadAudioToGCS = async (file: Express.Multer.File, userId: number | string): Promise<string> => {
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
    blobStream.on('error', (err) => {
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
};

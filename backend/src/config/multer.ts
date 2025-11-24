import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { Storage } from '@google-cloud/storage';

// Check if we should use GCS or local storage
const USE_GCS = process.env.USE_GCS === 'true';
const bucketName = process.env.GCS_BUCKET_NAME || 'japanese-learning-resources-couch-gcp-dev';
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Initialize GCS client only if needed
let storage: Storage | null = null;
let bucket: any = null;

if (USE_GCS) {
  storage = new Storage();
  bucket = storage.bucket(bucketName);
  console.log('Using GCS for file storage');
} else {
  // Ensure local uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  console.log('Using local disk for file storage');
}

// Configure multer storage based on environment
const storageEngine = USE_GCS 
  ? multer.memoryStorage() 
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, `${req.user?.userId || 'unknown'}-${uniqueSuffix}-${nameWithoutExt}${ext}`);
      }
    });

// File filter - only allow images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Configure multer
export const upload = multer({
  storage: storageEngine,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
});

// Helper function to upload file (GCS or local)
export const uploadToStorage = async (file: Express.Multer.File, userId: number | string): Promise<string> => {
  if (USE_GCS) {
    // Upload to GCS
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(file.originalname);
  const nameWithoutExt = path.basename(file.originalname, ext);
  const filename = `uploads/${userId}-${uniqueSuffix}-${nameWithoutExt}${ext}`;
  
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
    return `/uploads/${file.filename}`;
  }
};

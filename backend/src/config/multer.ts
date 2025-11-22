import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET_NAME || 'japanese-learning-resources-couch-gcp-dev';

// Initialize GCS client
const storage = new Storage();
const bucket = storage.bucket(bucketName);

// Configure multer to use memory storage (we'll upload to GCS manually)
const memoryStorage = multer.memoryStorage();

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
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
});

// Helper function to upload file to GCS
export const uploadToGCS = async (file: Express.Multer.File, userId: number | string): Promise<string> => {
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

import { Router, Request, Response } from 'express';
import multer from 'multer';
import WebSocket from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/transcribe - Transcribe audio using Vosk
router.post('/', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    // Create debug directory if it doesn't exist
    const debugDir = path.join(__dirname, '../../debug-audio');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    // Save original WebM file
    const timestamp = Date.now();
    const webmPath = path.join(debugDir, `original-${timestamp}.webm`);
    fs.writeFileSync(webmPath, req.file.buffer);
    console.log(`Saved original WebM to: ${webmPath} (${req.file.buffer.length} bytes)`);

    // Convert audio to PCM 16kHz mono for Vosk
    const audioBuffer = await convertAudioToPCM(req.file.buffer);
    console.log(`Audio converted: ${audioBuffer.length} bytes`);
    
    // Check if audio is too short
    const durationSeconds = audioBuffer.length / (16000 * 2); // 16kHz, 16-bit (2 bytes)
    console.log(`Audio duration: ${durationSeconds.toFixed(2)} seconds`);
    
    if (audioBuffer.length < 1000) {
      console.warn('WARNING: Audio buffer is very small, might be all silence!');
    }
    
    if (durationSeconds < 0.3) {
      console.warn('WARNING: Audio is very short (<0.3s), may not contain full word');
    }

    // Also save as WAV for easier listening
    const wavPath = path.join(debugDir, `converted-${timestamp}.wav`);
    await saveAsWAV(req.file.buffer, wavPath);
    console.log(`Saved converted WAV to: ${wavPath}`);

    // Connect to Vosk WebSocket server
    const voskServerUrl = process.env.VOSK_SERVER_URL || 'ws://localhost:2700';
    const ws = new WebSocket(voskServerUrl);

    let transcript = '';
    let partialTranscript = '';
    let error: string | null = null;

    ws.on('open', () => {
      console.log('Connected to Vosk server');
      
      // Send audio configuration
      ws.send(JSON.stringify({
        config: {
          sample_rate: 16000
        }
      }));

      // Send audio data in chunks
      const chunkSize = 8000;
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.slice(i, i + chunkSize);
        ws.send(chunk);
      }
      
      console.log('Audio data sent, sending EOF');
      
      // Send EOF to signal end of audio
      ws.send(JSON.stringify({ eof: 1 }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const result = JSON.parse(data.toString());
        console.log('Vosk response:', result);
        
        // Final result
        if (result.text) {
          transcript = result.text;
          console.log('Final transcript:', transcript);
        }
        
        // Partial result (interim recognition)
        if (result.partial && !transcript) {
          partialTranscript = result.partial;
          console.log('Partial transcript:', partialTranscript);
        }
      } catch (e) {
        console.error('Error parsing Vosk response:', e);
      }
    });

    ws.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
      error = err.message;
    });

    ws.on('close', () => {
      console.log('WebSocket closed');
      
      if (error) {
        return res.status(500).json({ error: 'Transcription failed', details: error });
      }
      
      // Use final transcript if available, otherwise use partial
      const finalTranscript = transcript || partialTranscript;
      console.log('Returning transcript:', finalTranscript);
      
      res.json({ transcript: finalTranscript || '' });
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// Convert audio to PCM 16kHz mono
function convertAudioToPCM(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    ffmpeg(inputStream)
      .inputFormat('webm')
      .inputOptions([
        '-avoid_negative_ts make_zero',  // Preserve start of audio
        '-fflags +genpts'                 // Generate timestamps to avoid drops
      ])
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      // Temporarily disabled silence removal to debug
      // .audioFilters([
      //   'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-40dB',
      //   'areverse',
      //   'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-40dB',
      //   'areverse'
      // ])
      .format('s16le')
      .on('error', (err: Error) => {
        reject(err);
      })
      .pipe()
      .on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks));
      })
      .on('error', (err: Error) => {
        reject(err);
      });
  });
}

// Save audio as WAV file for debugging
function saveAsWAV(inputBuffer: Buffer, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    ffmpeg(inputStream)
      .inputFormat('webm')
      .inputOptions([
        '-avoid_negative_ts make_zero',  // Preserve start of audio
        '-fflags +genpts'                 // Generate timestamps to avoid drops
      ])
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('error', (err: Error) => {
        reject(err);
      })
      .save(outputPath)
      .on('end', () => {
        resolve();
      });
  });
}

export default router;


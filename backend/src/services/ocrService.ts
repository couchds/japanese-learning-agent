import prisma from '../lib/prisma';
import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5001';

interface OCRElement {
  text: string;
  element_type: 'kanji' | 'vocabulary' | 'hiragana' | 'katakana' | 'unknown';
  features: {
    pos1?: string;
    pos2?: string;
    lemma?: string;
  };
}

interface OCRResponse {
  raw_text: string;
  elements: OCRElement[];
  total_elements: number;
}

export async function processImageOCR(imageId: number, imagePath: string): Promise<void> {
  try {
    console.log(`[OCR] Processing image ${imageId}: ${imagePath}`);

    // Check if file exists
    const fullPath = path.join(__dirname, '../../', imagePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[OCR] Image file not found: ${fullPath}`);
      return;
    }

    // Call OCR service
    const formData = new FormData();
    formData.append('image', fs.createReadStream(fullPath));

    const ocrResponse = await axios.post<OCRResponse>(
      `${OCR_SERVICE_URL}/ocr`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000, // 60 second timeout
      }
    );

    const ocrData = ocrResponse.data;
    console.log(`[OCR] Extracted ${ocrData.total_elements} elements from image ${imageId}`);

    // Process elements and match with database
    const elementsToCreate = [];

    for (const element of ocrData.elements) {
      let itemId: number | null = null;

      // Try to match with database
      if (element.element_type === 'kanji') {
        // Look up in kanji table by literal field
        const kanjiEntry = await prisma.kanji.findFirst({
          where: { literal: element.text },
        });
        if (kanjiEntry) {
          itemId = kanjiEntry.id;
        }
      } else if (element.element_type === 'vocabulary' || 
                 element.element_type === 'hiragana' || 
                 element.element_type === 'katakana') {
        // Look up in dictionary_entries by kanji or reading through relations
        // This works for vocabulary words and also pure hiragana/katakana words
        const dictEntry = await prisma.dictionary_entries.findFirst({
          where: {
            OR: [
              { entry_kanji: { some: { kanji: element.text } } },
              { entry_readings: { some: { reading: element.text } } },
              { entry_kanji: { some: { kanji: element.features.lemma || '' } } },
              { entry_readings: { some: { reading: element.features.lemma || '' } } },
            ],
          },
        });
        if (dictEntry) {
          itemId = dictEntry.id;
          // Update element_type to 'vocabulary' if matched
          if (element.element_type === 'hiragana' || element.element_type === 'katakana') {
            element.element_type = 'vocabulary';
          }
        }
      }

      elementsToCreate.push({
        resource_image_id: imageId,
        text: element.text,
        element_type: element.element_type,
        item_id: itemId,
        confidence: null,
        position_x: null,
        position_y: null,
        width: null,
        height: null,
      });
    }

    // Save to database
    await prisma.$transaction([
      // Create OCR elements
      prisma.ocr_elements.createMany({
        data: elementsToCreate,
        skipDuplicates: true,
      }),
      // Update resource_images
      prisma.resource_images.update({
        where: { id: imageId },
        data: {
          ocr_processed: true,
          ocr_raw_text: ocrData.raw_text,
        },
      }),
    ]);

    const matched = elementsToCreate.filter(e => e.item_id !== null).length;
    const unmatched = elementsToCreate.length - matched;
    
    console.log(`[OCR] Completed for image ${imageId}: ${matched} matched, ${unmatched} unmatched`);
  } catch (error: any) {
    console.error(`[OCR] Error processing image ${imageId}:`, error.message);
    
    // Mark as processed but with error (so we don't retry infinitely)
    try {
      await prisma.resource_images.update({
        where: { id: imageId },
        data: {
          ocr_processed: true,
          ocr_raw_text: `Error: ${error.message}`,
        },
      });
    } catch (dbError) {
      console.error(`[OCR] Failed to update error status:`, dbError);
    }
  }
}

export async function checkOCRServiceHealth(): Promise<boolean> {
  try {
    await axios.get(`${OCR_SERVICE_URL}/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}


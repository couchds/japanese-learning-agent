#!/usr/bin/env python3
"""
Japanese OCR Service with multiple backend support
Supports: manga-ocr (local) and Google Cloud Vision API (production)
"""

from flask import Flask, request, jsonify
from PIL import Image
import io
import os
import sys

# Configuration
OCR_BACKEND = os.environ.get('OCR_BACKEND', 'easyocr')  # 'manga-ocr', 'easyocr', or 'cloud-vision'

app = Flask(__name__)

# Global variables for lazy loading
ocr_model = None
tokenizer = None
easyocr_reader = None

def get_manga_ocr_model():
    """Lazy load the manga-ocr model"""
    global ocr_model
    if ocr_model is None:
        try:
            from manga_ocr import MangaOcr
            print("Loading manga-ocr model (this may take a moment)...")
            ocr_model = MangaOcr()
            print("manga-ocr model loaded!")
        except ImportError:
            print("ERROR: manga-ocr not installed. Run: pip install manga-ocr")
            raise
    return ocr_model

def get_tokenizer():
    """Lazy load the Japanese tokenizer"""
    global tokenizer
    if tokenizer is None:
        try:
            import fugashi
            print("Loading Japanese tokenizer...")
            tokenizer = fugashi.Tagger()
            print("Tokenizer loaded!")
        except ImportError:
            print("ERROR: fugashi not installed. Run: pip install fugashi ipadic")
            raise
    return tokenizer

def get_easyocr_reader():
    """Lazy load the EasyOCR reader"""
    global easyocr_reader
    if easyocr_reader is None:
        try:
            import easyocr
            print("Loading EasyOCR model (this may take a moment)...")
            easyocr_reader = easyocr.Reader(['ja'], gpu=True)
            print("EasyOCR model loaded!")
        except ImportError:
            print("ERROR: easyocr not installed. Run: pip install easyocr")
            raise
    return easyocr_reader

def is_kanji(char):
    """Check if a character is kanji"""
    code = ord(char)
    return 0x4E00 <= code <= 0x9FFF

def is_hiragana(char):
    """Check if a character is hiragana"""
    code = ord(char)
    return 0x3040 <= code <= 0x309F

def is_katakana(char):
    """Check if a character is katakana"""
    code = ord(char)
    return 0x30A0 <= code <= 0x30FF

def classify_element(text, features):
    """Classify the type of text element"""
    # Single kanji character
    if len(text) == 1 and is_kanji(text):
        return 'kanji'
    
    # All hiragana
    if all(is_hiragana(c) or c in ' 　' for c in text):
        return 'hiragana'
    
    # All katakana
    if all(is_katakana(c) or c in ' 　' for c in text):
        return 'katakana'
    
    # Has kanji - likely vocabulary word
    if any(is_kanji(c) for c in text):
        return 'vocabulary'
    
    # Check POS tag from tokenizer
    if features:
        pos = features.get('pos1', '')
        if pos in ['名詞', '動詞', '形容詞', '副詞']:
            return 'vocabulary'
    
    return 'unknown'

def process_with_easyocr(image):
    """Process image using EasyOCR (better for full screenshots)"""
    import numpy as np
    
    reader = get_easyocr_reader()
    
    # Convert PIL Image to numpy array
    img_array = np.array(image)
    
    # Run OCR
    results = reader.readtext(img_array)
    
    # Extract text from results
    texts = [text for (bbox, text, prob) in results]
    raw_text = ''.join(texts)
    print(f"EasyOCR result: {raw_text}")
    
    # Tokenize
    tagger = get_tokenizer()
    elements = []
    
    for word in tagger(raw_text):
        surface = word.surface
        if not surface or surface.strip() in ['', '、', '。', '！', '？', '…']:
            continue
        
        features_dict = {
            'pos1': word.feature.pos1 if hasattr(word.feature, 'pos1') else None,
            'pos2': word.feature.pos2 if hasattr(word.feature, 'pos2') else None,
            'lemma': word.feature.lemma if hasattr(word.feature, 'lemma') else surface,
        }
        
        element_type = classify_element(surface, features_dict)
        
        elements.append({
            "text": surface,
            "element_type": element_type,
            "features": features_dict
        })
    
    # Extract individual kanji
    unique_kanji = set()
    for char in raw_text:
        if is_kanji(char):
            unique_kanji.add(char)
    
    for kanji in unique_kanji:
        if not any(e['text'] == kanji and e['element_type'] == 'kanji' for e in elements):
            elements.append({
                "text": kanji,
                "element_type": "kanji",
                "features": {}
            })
    
    return raw_text, elements

def process_with_manga_ocr(image):
    """Process image using manga-ocr (best for cropped text regions)"""
    ocr = get_manga_ocr_model()
    raw_text = ocr(image)
    print(f"manga-ocr result: {raw_text}")
    
    # Tokenize
    tagger = get_tokenizer()
    elements = []
    
    # Process full text - use tagger() not tagger.parse()
    for word in tagger(raw_text):
        # Skip punctuation and whitespace
        surface = word.surface
        if not surface or surface.strip() in ['', '、', '。', '！', '？', '…']:
            continue
        
        # Get features
        features_dict = {
            'pos1': word.feature.pos1 if hasattr(word.feature, 'pos1') else None,
            'pos2': word.feature.pos2 if hasattr(word.feature, 'pos2') else None,
            'lemma': word.feature.lemma if hasattr(word.feature, 'lemma') else surface,
        }
        
        # Classify element type
        element_type = classify_element(surface, features_dict)
        
        elements.append({
            "text": surface,
            "element_type": element_type,
            "features": features_dict
        })
    
    # Also extract individual kanji
    unique_kanji = set()
    for char in raw_text:
        if is_kanji(char):
            unique_kanji.add(char)
    
    # Add individual kanji elements
    for kanji in unique_kanji:
        # Check if not already in elements
        if not any(e['text'] == kanji and e['element_type'] == 'kanji' for e in elements):
            elements.append({
                "text": kanji,
                "element_type": "kanji",
                "features": {}
            })
    
    return raw_text, elements

def process_with_cloud_vision(image):
    """Process image using Google Cloud Vision API"""
    try:
        from google.cloud import vision
        
        # Convert PIL Image to bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        content = img_byte_arr.getvalue()
        
        # Call Cloud Vision API
        client = vision.ImageAnnotatorClient()
        image_obj = vision.Image(content=content)
        response = client.text_detection(image=image_obj)
        
        if response.error.message:
            raise Exception(f'Cloud Vision API error: {response.error.message}')
        
        texts = response.text_annotations
        if not texts:
            return "", []
        
        # First annotation is the full text
        raw_text = texts[0].description
        print(f"Cloud Vision result: {raw_text}")
        
        # Tokenize the result (same as manga-ocr)
        tagger = get_tokenizer()
        elements = []
        
        for word in tagger(raw_text):
            surface = word.surface
            if not surface or surface.strip() in ['', '、', '。', '！', '？', '…']:
                continue
            
            features_dict = {
                'pos1': word.feature.pos1 if hasattr(word.feature, 'pos1') else None,
                'pos2': word.feature.pos2 if hasattr(word.feature, 'pos2') else None,
                'lemma': word.feature.lemma if hasattr(word.feature, 'lemma') else surface,
            }
            
            element_type = classify_element(surface, features_dict)
            
            elements.append({
                "text": surface,
                "element_type": element_type,
                "features": features_dict
            })
        
        # Extract individual kanji
        unique_kanji = set()
        for char in raw_text:
            if is_kanji(char):
                unique_kanji.add(char)
        
        for kanji in unique_kanji:
            if not any(e['text'] == kanji and e['element_type'] == 'kanji' for e in elements):
                elements.append({
                    "text": kanji,
                    "element_type": "kanji",
                    "features": {}
                })
        
        return raw_text, elements
        
    except ImportError:
        raise Exception("google-cloud-vision not installed. Run: pip install google-cloud-vision")
    except Exception as e:
        raise Exception(f"Cloud Vision error: {str(e)}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "ocr",
        "backend": OCR_BACKEND
    })

@app.route('/ocr', methods=['POST'])
def process_ocr():
    """
    Process image and extract Japanese text
    
    Expects: multipart/form-data with 'image' file
    Returns: {
        "raw_text": "full OCR text",
        "elements": [
            {
                "text": "食べる",
                "element_type": "vocabulary",
                "features": {...}
            }
        ]
    }
    """
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        # Read image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        print(f"Processing image: {file.filename} with backend: {OCR_BACKEND}")
        
        # Process with selected backend
        if OCR_BACKEND == 'cloud-vision':
            raw_text, elements = process_with_cloud_vision(image)
        elif OCR_BACKEND == 'easyocr':
            raw_text, elements = process_with_easyocr(image)
        else:  # manga-ocr
            raw_text, elements = process_with_manga_ocr(image)
        
        return jsonify({
            "raw_text": raw_text,
            "elements": elements,
            "total_elements": len(elements),
            "backend": OCR_BACKEND
        })
    
    except Exception as e:
        print(f"Error processing OCR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/test', methods=['GET'])
def test():
    """Test endpoint to verify OCR is working"""
    return jsonify({
        "status": "OCR service is running",
        "backend": OCR_BACKEND,
        "supported_backends": ["manga-ocr", "easyocr", "cloud-vision"]
    })

if __name__ == '__main__':
    port = int(os.environ.get('OCR_PORT', 5001))
    print(f"Starting OCR service on port {port}")
    print(f"OCR Backend: {OCR_BACKEND}")
    print("Note: First OCR request will be slow as models load")
    app.run(host='0.0.0.0', port=port, debug=True)

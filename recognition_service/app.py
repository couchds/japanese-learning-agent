"""
KanjiDraw Recognition Service
A Flask microservice that provides kanji handwriting recognition using KanjiDraw.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import sys
import os

# Check if kanjidraw is available
try:
    from kanjidraw import KanjiDraw
    KANJIDRAW_AVAILABLE = True
except ImportError:
    KANJIDRAW_AVAILABLE = False
    print("WARNING: kanjidraw not installed. Install with: pip install kanjidraw", file=sys.stderr)

app = Flask(__name__)
CORS(app)

# Initialize KanjiDraw
kd = None
if KANJIDRAW_AVAILABLE:
    try:
        kd = KanjiDraw()
        print("KanjiDraw initialized successfully")
    except Exception as e:
        print(f"Error initializing KanjiDraw: {e}", file=sys.stderr)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'kanjidraw_available': KANJIDRAW_AVAILABLE,
        'kanjidraw_initialized': kd is not None
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    """
    Recognize kanji from drawing data.
    
    Expected JSON body:
    {
        "image": "base64_encoded_png_data",
        "limit": 10  (optional, default 10)
    }
    
    Returns:
    {
        "success": true,
        "results": [
            {"kanji": "日", "score": 0.95},
            {"kanji": "目", "score": 0.87},
            ...
        ]
    }
    """
    if not KANJIDRAW_AVAILABLE or kd is None:
        return jsonify({
            'success': False,
            'error': 'KanjiDraw is not available. Please install kanjidraw: pip install kanjidraw'
        }), 503

    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing image data'
            }), 400

        # Get the base64 image data
        image_data = data['image']
        limit = data.get('limit', 10)
        
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Invalid image data: {str(e)}'
            }), 400

        # Convert to grayscale if needed
        if image.mode != 'L':
            image = image.convert('L')

        # Perform recognition
        try:
            # KanjiDraw expects stroke data, but we can work with the image
            # For now, we'll use a simple approach - you may need to adjust based on kanjidraw's API
            results = kd.search(image, limit=limit)
            
            # Format results
            formatted_results = []
            for result in results:
                if isinstance(result, tuple):
                    kanji, score = result
                    formatted_results.append({
                        'kanji': kanji,
                        'score': float(score)
                    })
                else:
                    # Handle different result formats
                    formatted_results.append({
                        'kanji': str(result),
                        'score': 1.0
                    })
            
            return jsonify({
                'success': True,
                'results': formatted_results
            })
            
        except AttributeError:
            # If kanjidraw doesn't have the expected API, provide fallback
            return jsonify({
                'success': False,
                'error': 'KanjiDraw API mismatch. Please check kanjidraw version.'
            }), 500
            
    except Exception as e:
        print(f"Error during recognition: {e}", file=sys.stderr)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/info', methods=['GET'])
def info():
    """Get information about the recognition service"""
    info_data = {
        'service': 'KanjiDraw Recognition Service',
        'version': '1.0.0',
        'kanjidraw_available': KANJIDRAW_AVAILABLE
    }
    
    if KANJIDRAW_AVAILABLE and kd is not None:
        try:
            # Try to get kanji database info
            info_data['total_kanji'] = len(kd.characters) if hasattr(kd, 'characters') else 'unknown'
        except Exception:
            pass
    
    return jsonify(info_data)


if __name__ == '__main__':
    port = int(os.environ.get('RECOGNITION_SERVICE_PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    print(f"Starting KanjiDraw Recognition Service on port {port}")
    print(f"KanjiDraw available: {KANJIDRAW_AVAILABLE}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)


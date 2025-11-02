"""
KanjiDraw Recognition Service
A Flask microservice that provides kanji handwriting recognition using KanjiDraw.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys

# Check if kanjidraw is available
try:
    import kanjidraw
    KANJIDRAW_AVAILABLE = True
    print("KanjiDraw imported successfully", file=sys.stderr)
except ImportError as e:
    KANJIDRAW_AVAILABLE = False
    print(f"WARNING: kanjidraw not installed. Install with: pip install kanjidraw", file=sys.stderr)
    print(f"Import error: {e}", file=sys.stderr)

app = Flask(__name__)
CORS(app)


def convert_svg_paths_to_strokes(paths):
    """
    Convert react-sketch-canvas SVG paths to kanjidraw stroke format.
    
    react-sketch-canvas exports paths like:
    [{
        "drawMode": true,
        "strokeColor": "#000",
        "strokeWidth": 8,
        "paths": [
            {"x": 87, "y": 105.96875},
            {"x": 89, "y": 107.96875},
            ...
        ]
    }]
    
    KanjiDraw expects: [[x1, y1, x2, y2], [x1, y1, x2, y2], ...]
    Each path object represents ONE stroke, so we simplify it to start -> end
    """
    strokes = []
    
    for path_obj in paths:
        if not isinstance(path_obj, dict):
            continue
        
        # Get the coordinate points from this path
        path_data = path_obj.get('paths', [])
        
        if not path_data or len(path_data) < 2:
            continue
        
        # Collect all points from this stroke
        points = []
        for point in path_data:
            if isinstance(point, dict) and 'x' in point and 'y' in point:
                try:
                    x = float(point['x'])
                    y = float(point['y'])
                    points.append((x, y))
                except (ValueError, TypeError):
                    continue
        
        if len(points) < 2:
            continue
        
        # Treat each path as ONE stroke: from first point to last point
        # This matches how KanjiDraw expects stroke data
        x1, y1 = points[0]
        x2, y2 = points[-1]
        strokes.append([x1, y1, x2, y2])
    
    return strokes


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'kanjidraw_available': KANJIDRAW_AVAILABLE
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    """
    Recognize kanji from drawing stroke data.
    
    Expected JSON body:
    {
        "paths": [  // SVG paths from react-sketch-canvas
            {
                "drawMode": true,
                "strokeColor": "#000",
                "strokeWidth": 8,
                "paths": ["M 100 50 L 200 150"]
            }
        ],
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
    if not KANJIDRAW_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'KanjiDraw is not available. Please install kanjidraw: pip install kanjidraw'
        }), 503

    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400

        # Get stroke paths from the request
        paths = data.get('paths', [])
        limit = min(data.get('limit', 10), 25)  # Cap at 25
        
        if not paths:
            return jsonify({
                'success': False,
                'error': 'No stroke data provided'
            }), 400
        
        # Debug: log the structure of incoming data
        print(f"Received {len(paths)} path objects", file=sys.stderr)
        if paths:
            print(f"First path object type: {type(paths[0])}", file=sys.stderr)
            print(f"First path object: {paths[0]}", file=sys.stderr)
            if isinstance(paths[0], dict) and 'paths' in paths[0]:
                path_data = paths[0]['paths']
                if path_data:
                    print(f"First path data type: {type(path_data[0])}", file=sys.stderr)
                    print(f"First path data sample: {path_data[0]}", file=sys.stderr)
        
        # Convert SVG paths to kanjidraw stroke format
        strokes = convert_svg_paths_to_strokes(paths)
        
        if not strokes:
            return jsonify({
                'success': False,
                'error': 'Could not parse stroke data'
            }), 400
        
        print(f"Received {len(strokes)} strokes", file=sys.stderr)
        print(f"First few strokes: {strokes[:3]}", file=sys.stderr)
        
        # Perform recognition using fuzzy matching
        try:
            matches = list(kanjidraw.fuzzy_matches(strokes))[:limit]
            
            # Format results
            formatted_results = []
            for score, kanji in matches:
                formatted_results.append({
                    'kanji': kanji,
                    'score': float(score) / 100.0  # Convert 0-100 to 0.0-1.0
                })
            
            print(f"Found {len(formatted_results)} matches", file=sys.stderr)
            
            return jsonify({
                'success': True,
                'results': formatted_results,
                'stroke_count': len(strokes)
            })
            
        except Exception as e:
            print(f"KanjiDraw matching error: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Recognition error: {str(e)}'
            }), 500
            
    except Exception as e:
        print(f"Error during recognition: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
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
    
    if KANJIDRAW_AVAILABLE:
        try:
            kanji_db = kanjidraw.kanji_data()
            # Count total unique kanji characters
            total_kanji = sum(len(strokes_dict) for strokes_dict in kanji_db.values())
            info_data['total_kanji'] = total_kanji
        except Exception as e:
            info_data['error'] = str(e)
    
    return jsonify(info_data)


if __name__ == '__main__':
    import os
    port = int(os.environ.get('RECOGNITION_SERVICE_PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    print(f"Starting KanjiDraw Recognition Service on port {port}")
    print(f"KanjiDraw available: {KANJIDRAW_AVAILABLE}")
    
    if KANJIDRAW_AVAILABLE:
        print("Service ready to recognize kanji from stroke data")
    
    app.run(host='0.0.0.0', port=port, debug=debug)


"""
Flask API service for speech model training and prediction.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import threading
import tempfile
from pathlib import Path
from datetime import datetime
import json

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from predict import KeywordPredictor

app = Flask(__name__)
CORS(app)

# Global state
TRAINING_STATUS = {
    'is_training': False,
    'status': 'idle',
    'progress': 0,
    'message': '',
    'started_at': None,
    'completed_at': None,
    'accuracy': None,
    'error': None
}

MODEL_INFO = {
    'is_trained': False,
    'model_path': None,
    'num_classes': 0,
    'class_names': [],
    'trained_at': None,
    'accuracy': None
}

PREDICTOR = None


def load_model_if_exists():
    """Load model on startup if it exists."""
    global PREDICTOR, MODEL_INFO
    
    model_path = Path('models/keyword_spotting/best_model.pt')
    if model_path.exists():
        try:
            print("Loading existing model...", file=sys.stderr)
            PREDICTOR = KeywordPredictor(str(model_path))
            
            MODEL_INFO['is_trained'] = True
            MODEL_INFO['model_path'] = str(model_path)
            MODEL_INFO['num_classes'] = len(PREDICTOR.idx_to_label)
            MODEL_INFO['class_names'] = [PREDICTOR.idx_to_label[str(i)] 
                                          for i in range(len(PREDICTOR.idx_to_label))]
            MODEL_INFO['trained_at'] = datetime.fromtimestamp(model_path.stat().st_mtime).isoformat()
            
            print(f"Model loaded: {MODEL_INFO['num_classes']} classes", file=sys.stderr)
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'model_loaded': PREDICTOR is not None,
        'is_training': TRAINING_STATUS['is_training']
    })


@app.route('/info', methods=['GET'])
def info():
    """Get model information."""
    return jsonify({
        'model': MODEL_INFO,
        'training': TRAINING_STATUS
    })


@app.route('/train', methods=['POST'])
def train():
    """
    Trigger model training.
    
    Expected JSON body:
    {
        "epochs": 50,
        "batch_size": 32,
        "model": "full",  // or "lightweight"
        "augment": true
    }
    """
    global TRAINING_STATUS
    
    if TRAINING_STATUS['is_training']:
        return jsonify({
            'success': False,
            'error': 'Training already in progress'
        }), 400
    
    # Get training parameters
    data = request.get_json() or {}
    epochs = data.get('epochs', 50)
    batch_size = data.get('batch_size', 32)
    model_type = data.get('model', 'full')
    augment = data.get('augment', True)
    val_split = data.get('val_split', 0.2)
    
    # Reset training status
    TRAINING_STATUS['is_training'] = True
    TRAINING_STATUS['status'] = 'starting'
    TRAINING_STATUS['progress'] = 0
    TRAINING_STATUS['message'] = 'Initializing training...'
    TRAINING_STATUS['started_at'] = datetime.now().isoformat()
    TRAINING_STATUS['completed_at'] = None
    TRAINING_STATUS['accuracy'] = None
    TRAINING_STATUS['error'] = None
    
    # Start training in background thread
    thread = threading.Thread(
        target=run_training,
        args=(epochs, batch_size, model_type, augment, val_split)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'success': True,
        'message': 'Training started',
        'parameters': {
            'epochs': epochs,
            'batch_size': batch_size,
            'model': model_type,
            'augment': augment,
            'val_split': val_split
        }
    })


def run_training(epochs, batch_size, model_type, augment, val_split):
    """Run training in background thread."""
    global TRAINING_STATUS, PREDICTOR, MODEL_INFO
    
    try:
        import subprocess
        import sys
        
        TRAINING_STATUS['status'] = 'training'
        TRAINING_STATUS['message'] = 'Training model...'
        
        # Build command
        cmd = [
            sys.executable,
            'src/train.py',
            '--epochs', str(epochs),
            '--batch-size', str(batch_size),
            '--model', model_type,
            '--val-split', str(val_split),
        ]
        
        if augment:
            cmd.append('--augment')
        
        print(f"Running: {' '.join(cmd)}", file=sys.stderr)
        
        # Run training process
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        # Monitor output
        for line in process.stdout:
            print(line, end='', file=sys.stderr)
            
            # Update progress based on output
            if 'Epoch' in line:
                try:
                    # Extract epoch number
                    parts = line.split('/')
                    if len(parts) >= 2:
                        current = int(parts[0].split()[-1])
                        total = int(parts[1].split()[0])
                        progress = int((current / total) * 100)
                        TRAINING_STATUS['progress'] = progress
                        TRAINING_STATUS['message'] = f'Epoch {current}/{total}'
                except:
                    pass
            
            # Extract final accuracy
            if 'Best validation accuracy' in line:
                try:
                    acc = float(line.split(':')[-1].strip().rstrip('%'))
                    TRAINING_STATUS['accuracy'] = acc
                except:
                    pass
        
        process.wait()
        
        if process.returncode == 0:
            TRAINING_STATUS['status'] = 'completed'
            TRAINING_STATUS['progress'] = 100
            TRAINING_STATUS['message'] = 'Training completed successfully'
            TRAINING_STATUS['completed_at'] = datetime.now().isoformat()
            
            # Reload model
            load_model_if_exists()
        else:
            raise Exception(f'Training process failed with code {process.returncode}')
            
    except Exception as e:
        TRAINING_STATUS['status'] = 'failed'
        TRAINING_STATUS['error'] = str(e)
        TRAINING_STATUS['message'] = f'Training failed: {str(e)}'
        print(f"Training error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    finally:
        TRAINING_STATUS['is_training'] = False


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict keyword from audio file.
    
    Expected: multipart/form-data with 'audio' file
    
    Returns:
    {
        "success": true,
        "predictions": [
            {"word": "ぼうけん", "confidence": 0.95},
            {"word": "たべる", "confidence": 0.03},
            ...
        ]
    }
    """
    global PREDICTOR
    
    if PREDICTOR is None:
        return jsonify({
            'success': False,
            'error': 'No trained model available. Please train a model first.'
        }), 503
    
    try:
        # Check if audio file is in request
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No audio file provided'
            }), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No audio file selected'
            }), 400
        
        # Get top_k parameter
        top_k = int(request.form.get('top_k', 5))
        
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        try:
            # Predict
            print(f"Predicting from audio file: {tmp_path}", file=sys.stderr)
            results = PREDICTOR.predict(tmp_path, top_k=top_k)
            
            # Format results
            predictions = [
                {'word': word, 'confidence': float(confidence)}
                for word, confidence in results
            ]
            
            print(f"Prediction: {predictions[0]['word']} ({predictions[0]['confidence']:.2%})", 
                  file=sys.stderr)
            
            return jsonify({
                'success': True,
                'predictions': predictions
            })
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except Exception as e:
                print(f"Warning: Could not delete temp file {tmp_path}: {e}", file=sys.stderr)
    
    except Exception as e:
        print(f"Error during prediction: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/export-data', methods=['POST'])
def export_data():
    """
    Export training data from database.
    
    This runs the export_training_data.py script.
    """
    try:
        import subprocess
        
        print("Exporting training data...", file=sys.stderr)
        
        result = subprocess.run(
            [sys.executable, 'scripts/export_training_data.py'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            # Count exported files
            audio_dir = Path('data/training/audio')
            num_files = len(list(audio_dir.glob('*.webm'))) if audio_dir.exists() else 0
            
            return jsonify({
                'success': True,
                'message': 'Data exported successfully',
                'num_recordings': num_files,
                'output': result.stdout
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Export failed',
                'output': result.stderr
            }), 500
            
    except Exception as e:
        print(f"Error exporting data: {e}", file=sys.stderr)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    # Load existing model if available
    load_model_if_exists()
    
    port = int(os.environ.get('SPEECH_MODEL_PORT', 5001))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    print(f"Starting Speech Model API on port {port}")
    print(f"Model loaded: {PREDICTOR is not None}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)


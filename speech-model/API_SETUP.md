# Speech Model API - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd speech-model
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Start the API Service

```bash
python api.py
```

The API will start on `http://localhost:5001`

### 3. Start Your Backend & Frontend

In separate terminals:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm start
```

## Using the Frontend

1. Navigate to **Pronunciation Training** page
2. Click **"Show Custom Model"** button to expand the model panel
3. Record some words and mark them as "Reference" pronunciations
4. Click **"Train Custom Model"** to start training
5. Watch the progress bar as your model trains
6. Once complete, toggle **"Use custom model for recognition"** to test it!

## API Endpoints

### GET /health
Health check
```bash
curl http://localhost:5001/health
```

### GET /info
Get model and training status
```bash
curl http://localhost:5001/info
```

### POST /export-data
Export training data from database
```bash
curl -X POST http://localhost:5001/export-data
```

### POST /train
Start training
```bash
curl -X POST http://localhost:5001/train \
  -H "Content-Type: application/json" \
  -d '{"epochs": 50, "batch_size": 32, "model": "full", "augment": true}'
```

### POST /predict
Predict from audio
```bash
curl -X POST http://localhost:5001/predict \
  -F "audio=@path/to/audio.webm" \
  -F "top_k=5"
```

## Troubleshooting

**"Connection refused" errors**
- Make sure the speech model API is running: `python api.py`
- Check it's running on port 5001: `curl http://localhost:5001/health`

**Training fails immediately**
- Make sure you have reference recordings in the database
- Run export script manually to check: `python scripts/export_training_data.py`

**No recordings found**
- Record some words in the Pronunciation Training page
- Mark them as "Reference" (not just "Practice")
- Need at least 5-10 recordings per word for good results

**Training is slow**
- This is normal on CPU (10-30 minutes for 50 epochs)
- Consider using `"model": "lightweight"` for faster training
- Or reduce epochs: `"epochs": 20`

## Running Services Together

For convenience, you can create a startup script:

```bash
#!/bin/bash
# start-all.sh

# Start backend
cd backend && npm run dev &

# Start frontend
cd frontend && npm start &

# Start speech model API
cd speech-model
source venv/bin/activate
python api.py &

wait
```

Make it executable: `chmod +x start-all.sh`
Run: `./start-all.sh`


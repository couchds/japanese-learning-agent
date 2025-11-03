# Custom Speech Recognition Model

This directory contains the custom speech recognition model training system for Japanese pronunciation.

## Directory Structure

```
speech-model/
├── data/               # Training data (audio files + labels)
├── models/             # Saved model checkpoints
├── notebooks/          # Jupyter notebooks for experimentation
├── src/                # Source code for model training
├── scripts/            # Utility scripts (data export, preprocessing)
└── requirements.txt    # Python dependencies
```

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Workflow

1. **Export Training Data**: Export reference pronunciations from the database
2. **Preprocess Audio**: Convert audio to consistent format and extract features
3. **Train Model**: Fine-tune a pre-trained model or train from scratch
4. **Evaluate**: Test model accuracy on held-out data
5. **Deploy**: Integrate model back into the application

## Approaches

### 1. Keyword Spotting (Lightweight)
- Train a small CNN to recognize specific words you've learned
- Fast, runs on CPU
- Best for: Small vocabulary (10-100 words)

### 2. Fine-tuned Wav2Vec2 (Medium)
- Start with pre-trained Japanese model
- Fine-tune on your voice
- Best for: Growing vocabulary (100-1000 words)

### 3. Fine-tuned Whisper (Advanced)
- Most accurate, but requires more data
- Best for: Large vocabulary (1000+ words)

## Current Status

- [ ] Data export script
- [ ] Audio preprocessing pipeline
- [ ] Model architecture selection
- [ ] Training script
- [ ] Evaluation metrics
- [ ] Deployment integration


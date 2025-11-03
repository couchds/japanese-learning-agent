# Keyword Spotting CNN - Quick Start Guide

## Setup

```bash
cd speech-model

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Step 1: Export Your Training Data

```bash
# Export pronunciation recordings from database
python scripts/export_training_data.py
```

This will create:
- `data/training/audio/` - Your audio files
- `data/training/manifest.csv` - Labels for each file

## Step 2: Train the Model

```bash
# Train with default settings
python src/train.py

# Or with custom settings
python src/train.py \
    --epochs 100 \
    --batch-size 16 \
    --model full \
    --augment
```

### Training Options:

| Option | Default | Description |
|--------|---------|-------------|
| `--epochs` | 50 | Number of training epochs |
| `--batch-size` | 32 | Batch size |
| `--model` | full | Model type (full or lightweight) |
| `--augment` | False | Apply data augmentation |
| `--lr` | 0.001 | Learning rate |
| `--dropout` | 0.5 | Dropout rate |

**Model Types:**
- `full`: ~2M parameters, best accuracy
- `lightweight`: ~300K parameters, faster inference

## Step 3: Test the Model

```bash
# Predict from audio file
python src/predict.py path/to/audio.webm

# Show top-10 predictions
python src/predict.py path/to/audio.webm --top-k 10

# Use specific model
python src/predict.py path/to/audio.webm --model models/keyword_spotting/best_model.pt
```

## Expected Results

### With Small Dataset (10-50 words, 5-10 recordings each):
- Training time: 5-15 minutes (CPU)
- Accuracy: 85-95% on your voice
- Model size: ~8MB

### With Larger Dataset (50-200 words):
- Training time: 20-60 minutes (CPU)
- Accuracy: 90-98% on your voice
- Model size: ~8MB

## Output Files

After training, you'll find:
```
models/keyword_spotting/
├── best_model.pt           # Best model based on validation accuracy
├── final_model.pt          # Model from last epoch
└── training_curves.png     # Training/validation curves
```

## Monitoring Training

Watch for:
- **Overfitting**: Train accuracy >> validation accuracy
  - Solution: Increase dropout, reduce epochs, add more data
- **Underfitting**: Low train and validation accuracy
  - Solution: Train longer, reduce dropout, use full model
- **Good fit**: Train and validation accuracies close and high

## Tips for Best Results

1. **Record consistently**: Same environment, microphone, volume
2. **Multiple recordings per word**: Aim for 5-10 minimum
3. **Vary your pronunciation**: Slightly different speeds/tones
4. **Use data augmentation**: Add `--augment` flag when training
5. **Train longer**: If accuracy plateaus, add more epochs

## Next Steps

Once trained:
1. Test on new recordings
2. Deploy model to production
3. Integrate with your app's training page
4. Continue collecting data to improve model

## Troubleshooting

**"No such file or directory: data/training/manifest.csv"**
- Run `python scripts/export_training_data.py` first

**"RuntimeError: CUDA out of memory"**
- Use `--batch-size 8` or `--model lightweight`

**Low accuracy (<70%)**
- Need more training data (aim for 10+ recordings per word)
- Try `--augment` flag
- Train longer (`--epochs 100`)

**Model works on your voice but not others**
- This is expected! Model is personalized to YOU
- This is actually a feature for language learning


# KanjiDraw Recognition Service

A Python Flask microservice that provides kanji handwriting recognition using the KanjiDraw library.

## Setup

### 1. Create Virtual Environment

```bash
cd recognition_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Service

```bash
# Development mode
export FLASK_DEBUG=true  # On Windows: set FLASK_DEBUG=true
python app.py
```

The service will start on http://localhost:5000

### 4. Configure Port (Optional)

```bash
export RECOGNITION_SERVICE_PORT=5000  # Change port if needed
```

## API Endpoints

### POST /recognize

Recognize kanji from a base64-encoded PNG image.

**Request:**
```json
{
  "image": "data:image/png;base64,iVBORw0KG...",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {"kanji": "日", "score": 0.95},
    {"kanji": "目", "score": 0.87},
    {"kanji": "白", "score": 0.82}
  ]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "kanjidraw_available": true,
  "kanjidraw_initialized": true
}
```

### GET /info

Get service information.

**Response:**
```json
{
  "service": "KanjiDraw Recognition Service",
  "version": "1.0.0",
  "kanjidraw_available": true,
  "total_kanji": 6355
}
```

## Running in Production

For production, use a WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```


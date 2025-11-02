# KanjiDraw Recognition Service - Quick Start

This guide will help you set up and test the kanji handwriting recognition feature.

## Prerequisites

- Python 3.8 or higher
- pip package manager
- The backend and frontend already set up

## Installation

1. **Navigate to the recognition service directory:**
   ```bash
   cd recognition_service
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment:**
   - On Linux/Mac:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

   This will install:
   - Flask (web framework)
   - Flask-CORS (CORS support)
   - Pillow (image processing)
   - kanjidraw (kanji recognition library)

## Running the Service

1. **Make sure you're in the recognition_service directory with the virtual environment activated**

2. **Start the service:**
   ```bash
   python app.py
   ```

   You should see:
   ```
   Starting KanjiDraw Recognition Service on port 5000
   KanjiDraw available: True
    * Running on http://0.0.0.0:5000
   ```

3. **Test the service** (in another terminal):
   ```bash
   curl http://localhost:5000/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "kanjidraw_available": true,
     "kanjidraw_initialized": true
   }
   ```

## Using the Feature

1. **Start all services:**
   - Recognition service (port 5000) - this terminal
   - Backend API (port 3001) - another terminal
   - Frontend (port 3000) - another terminal

2. **Navigate to the Draw Kanji page:**
   - Open http://localhost:3000 in your browser
   - Go to Dictionary → Draw Kanji

3. **Draw a kanji:**
   - Draw a character in the canvas
   - Click "Search Kanji"
   - View recognition results with meanings and readings

## Troubleshooting

### "KanjiDraw is not available"
- Make sure you installed the dependencies: `pip install -r requirements.txt`
- Check that kanjidraw installed correctly: `pip list | grep kanjidraw`

### "Recognition service unavailable"
- Ensure the Python service is running on port 5000
- Check the service status: `curl http://localhost:5000/health`
- Verify CORS is working (check browser console)

### Port 5000 already in use
- Change the port in the service:
  ```bash
  export RECOGNITION_SERVICE_PORT=5001
  python app.py
  ```
- Update `backend/.env`:
  ```bash
  RECOGNITION_SERVICE_URL=http://localhost:5001
  ```

### Poor recognition accuracy
- Draw strokes in the correct order
- Keep the character centered in the canvas
- Try using a thicker stroke width
- Ensure the character is complete and clear

## API Documentation

See [README.md](README.md) for full API documentation.

## Development

To run in development mode with debug logging:
```bash
export FLASK_DEBUG=true
python app.py
```

## Production Deployment

For production, use a WSGI server like Gunicorn:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```


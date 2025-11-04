# Recognition Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY *.md . 2>/dev/null || true

# Expose recognition service port
EXPOSE 5000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV RECOGNITION_SERVICE_PORT=5000
ENV FLASK_DEBUG=false

# Run the Flask application
CMD ["python", "app.py"]


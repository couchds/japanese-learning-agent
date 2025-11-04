#!/bin/bash
# Database initialization script for Docker deployment
# This script should be run after starting the Docker containers

set -e

echo "================================================"
echo "Japanese Learning Platform - Database Setup"
echo "================================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed."
    exit 1
fi

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "Starting Docker containers..."
    docker-compose up -d
    echo "Waiting for services to be ready..."
    sleep 10
fi

echo "Step 1: Applying Prisma migrations..."
docker-compose exec -T backend npx prisma migrate deploy
echo "✓ Prisma migrations applied"
echo ""

echo "Step 2: Setting up kanji data from kanjidic2.xml..."
if [ ! -f "requirements.txt" ]; then
    echo "Error: requirements.txt not found. Are you in the project root?"
    exit 1
fi

# Check if Python dependencies are installed
if ! python3 -c "import psycopg2" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
fi

echo "Running setup_db.py..."
python3 scripts/setup_db.py
echo "✓ Kanji data loaded"
echo ""

echo "Step 3: Setting up dictionary data from JMdict_e..."
python3 scripts/setup_jmdict.py
echo "✓ Dictionary data loaded"
echo ""

echo "Step 4: Creating local user..."
python3 scripts/setup_local.py
echo "✓ Local user created"
echo ""

echo "================================================"
echo "Database setup complete!"
echo "================================================"
echo ""
echo "You can now access the application at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""


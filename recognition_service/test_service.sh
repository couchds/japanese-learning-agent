#!/bin/bash
# Test script to verify the recognition service is working

echo "Testing KanjiDraw Recognition Service..."
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:5000/health)
echo "Response: $HEALTH_RESPONSE"
echo ""

# Test 2: Info endpoint
echo "2. Testing info endpoint..."
INFO_RESPONSE=$(curl -s http://localhost:5000/info)
echo "Response: $INFO_RESPONSE"
echo ""

# Check if service is running
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo "✓ Service is running!"
else
    echo "✗ Service appears to be down. Make sure to start it with: python app.py"
fi


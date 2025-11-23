#!/bin/bash
# Build standalone executable for Yomunami OCR Client

echo "🔨 Building Yomunami OCR Client Executable..."
echo ""

# Install PyInstaller if not already installed
pip install pyinstaller

# Build the executable
pyinstaller --name="Yomunami-OCR-Client" \
    --onefile \
    --windowed \
    --icon=icon.ico \
    --add-data="README.md:." \
    screenshot_client_gui.py

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Executable location:"
echo "   dist/Yomunami-OCR-Client"
echo ""
echo "🚀 You can now run the executable by double-clicking it!"


@echo off
REM Build standalone executable for Yomunami OCR Client (Windows)

echo Building Yomunami OCR Client Executable...
echo.

REM Install PyInstaller if not already installed
pip install pyinstaller

REM Build the executable
pyinstaller --name="Yomunami-OCR-Client" ^
    --onefile ^
    --windowed ^
    --add-data="README.md;." ^
    screenshot_client_gui.py

echo.
echo Build complete!
echo.
echo Executable location: dist\Yomunami-OCR-Client.exe
echo.
echo You can now run the .exe file by double-clicking it!
pause


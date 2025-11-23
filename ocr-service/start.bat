@echo off
REM Start OCR Service

echo Starting Japanese OCR Service...

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Start the service
echo Starting OCR service on port 5001...
python app.py

pause


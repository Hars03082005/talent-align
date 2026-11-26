@echo off
echo ======================================================================
echo Starting TalentAlign - Proactive Talent Alignment Platform
echo ======================================================================

echo [1/3] Verifying Python environment...
python --version
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)

echo [2/3] Launching FastAPI Backend on http://localhost:8000 ...
start "TalentAlign Backend (FastAPI)" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [3/3] Launching React Vite Frontend on http://localhost:5173 ...
cd frontend
start "TalentAlign Frontend (Vite)" cmd /k "npm run dev"
cd ..

echo ======================================================================
echo Services started successfully!
echo   * Backend REST API: http://localhost:8000
echo   * Swagger API Docs: http://localhost:8000/docs
echo   * Web Application:  http://localhost:5173
echo ======================================================================

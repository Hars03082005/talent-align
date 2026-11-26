#!/bin/bash
# start_app.sh -- Unix/Mac startup script for Proactive Talent Alignment
# Starts FastAPI backend (port 8000) and React Vite frontend (port 3000)

echo "============================================================"
echo " Proactive Talent Alignment - AI Job Intelligence Platform"
echo "============================================================"
echo ""
echo "Starting FastAPI backend on http://localhost:8000 ..."
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

sleep 2

echo "Starting React Vite frontend on http://localhost:3000 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "Both services started."
echo "React Frontend UI: http://localhost:3000"
echo "Backend API docs:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait $BACKEND_PID $FRONTEND_PID

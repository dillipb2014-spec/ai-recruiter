#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting GeniusHire AI ecosystem..."

# Kill any existing instances
pkill -f "node src/server.js" 2>/dev/null
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 1

# Backend
cd "$ROOT/backend"
node src/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend     → http://localhost:4000  (PID $BACKEND_PID)"

# AI Service
cd "$ROOT/ai-service"
source "$ROOT/.venv/bin/activate"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/ai-service.log 2>&1 &
AI_PID=$!
echo "✅ AI Service  → http://localhost:8000  (PID $AI_PID)"

# Frontend
cd "$ROOT/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FE_PID=$!
echo "✅ Frontend    → http://localhost:3000  (PID $FE_PID)"

echo ""
echo "📋 Logs:"
echo "   tail -f /tmp/backend.log"
echo "   tail -f /tmp/ai-service.log"
echo "   tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop all:  pkill -f 'node src/server.js'; pkill -f 'uvicorn main:app'; pkill -f 'next dev'"
echo ""

# Wait and health check after 5s
sleep 5
echo "── Health Checks ──────────────────────────────"
curl -s http://localhost:4000/health && echo " ← Backend" || echo "❌ Backend not responding"
curl -s http://localhost:8000/health && echo " ← AI Service" || echo "❌ AI Service not responding"
echo "───────────────────────────────────────────────"

wait

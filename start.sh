#!/bin/bash
# Start NutriRight — runs server (port 3002) and client (port 5176) concurrently

echo "🥦 Starting NutriRight..."

# Start backend
cd "$(dirname "$0")/server"
node index.js &
SERVER_PID=$!
echo "  ✓ Server started (PID $SERVER_PID) → http://localhost:3002"

# Start frontend
cd "$(dirname "$0")/client"
npx vite --port 5176 &
CLIENT_PID=$!
echo "  ✓ Client starting → http://localhost:5176"

echo ""
echo "  Share http://localhost:5176 with players on your network."
echo "  Press Ctrl+C to stop."

trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait

#!/bin/bash
# Mega-script: starts servers, waits for ready, runs browser tests, keeps servers alive.
cd /home/z/my-project

# Kill stale
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun index.ts" 2>/dev/null || true
pkill -f "start-all" 2>/dev/null || true
pkill -f "supervise" 2>/dev/null || true
sleep 2
rm -f /home/z/my-project/.vote-service.lock
> /home/z/my-project/vote-service.log
> /home/z/my-project/dev-server.log

# Start vote-service
(cd /home/z/my-project/mini-services/vote-service && bun index.ts) > /home/z/my-project/vote-service.log 2>&1 &
VOTE_PID=$!

# Start Next.js
(cd /home/z/my-project && bun run dev) > /home/z/my-project/dev-server.log 2>&1 &
NEXT_PID=$!

echo "Started vote=$VOTE_PID next=$NEXT_PID"

# Wait for ready
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  NEXT_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
  VOTE_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3003/?EIO=4&transport=polling" 2>/dev/null || echo "000")
  if [ "$NEXT_OK" = "200" ] && [ "$VOTE_OK" = "200" ]; then
    echo "READY after $((i*2))s"
    break
  fi
done

# Run agent-browser tests
echo "=== BROWSER: OPEN LANDING ==="
agent-browser cookies clear 2>&1 | tail -1
agent-browser open "http://localhost:81/" 2>&1 | tail -1
sleep 5
agent-browser snapshot -i > /tmp/kela-snap-1.txt 2>&1
echo "--- LANDING SNAPSHOT ---"
head -15 /tmp/kela-snap-1.txt

# Fill create room form
echo "=== BROWSER: CREATE ROOM ==="
# Find the form fields by label
agent-browser find label "Room Name (optional)" fill "Office Kela Circle" 2>&1 | tail -1
agent-browser find label "Your Name" fill "Ali Host" 2>&1 | tail -1
agent-browser find label "Your Email" fill "ali@host.com" 2>&1 | tail -1
agent-browser find text "Create Room 🍌" click 2>&1 | tail -1
sleep 5
agent-browser get url > /tmp/kela-url.txt 2>&1
echo "--- URL AFTER CREATE ---"
cat /tmp/kela-url.txt
agent-browser snapshot -i > /tmp/kela-snap-2.txt 2>&1
echo "--- DASHBOARD SNAPSHOT (first 20 lines) ---"
head -20 /tmp/kela-snap-2.txt

# Save the room URL for later
ROOM_URL=$(cat /tmp/kela-url.txt | tail -1 | tr -d ' ')
echo "ROOM_URL=$ROOM_URL"

# Keep servers alive
echo "=== SERVERS ALIVE, WAITING ==="
exec wait

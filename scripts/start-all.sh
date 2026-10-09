#!/bin/bash
# All-in-one launcher + tester for Kela Tracker.
# Runs in foreground so all child processes stay alive during the test.

set -e

# Clean up any stale processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun index.ts" 2>/dev/null || true
pkill -f "supervise" 2>/dev/null || true
sleep 1
rm -f /home/z/my-project/.vote-service.lock
> /home/z/my-project/vote-service.log

# Start vote-service in background
cd /home/z/my-project/mini-services/vote-service
bun index.ts > /home/z/my-project/vote-service.log 2>&1 &
VOTE_PID=$!
echo "vote-service PID: $VOTE_PID"

# Start Next.js dev server in background
cd /home/z/my-project
bun run dev > /home/z/my-project/dev-server.log 2>&1 &
NEXT_PID=$!
echo "next dev PID: $NEXT_PID"

# Wait for both to be ready
for i in 1 2 3 4 5 6 7 8 9 10 15 20 25; do
  sleep 2
  NEXT_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
  VOTE_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3003/?EIO=4&transport=polling" 2>/dev/null || echo "000")
  echo "  attempt $i: next=$NEXT_OK vote=$VOTE_OK"
  if [ "$NEXT_OK" = "200" ] && [ "$VOTE_OK" = "200" ]; then
    echo "Both servers ready!"
    break
  fi
done

# Verify final state
echo "=== FINAL STATUS ==="
ps -p $VOTE_PID -o pid,cmd 2>&1 | tail -1
ps -p $NEXT_PID -o pid,cmd 2>&1 | tail -1
ss -tlnp 2>/dev/null | grep -E "3000|3003"

# Keep the script running so children stay alive
echo "Servers running. Press Ctrl+C to stop."
wait

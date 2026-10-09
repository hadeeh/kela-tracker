#!/bin/bash
# Supervisor for the Kela Tracker dev environment.
# Starts BOTH the Next.js dev server AND the vote-service, and respawns
# either one if it dies. Designed to survive bash tool subshell cleanups
# by being launched with setsid + nohup + disown.

LOG=/home/z/my-project/dev-server.log
VOTE_LOG=/home/z/my-project/vote-service.log
PROJECT_DIR=/home/z/my-project
VOTE_DIR=/home/z/my-project/mini-services/vote-service

# Kill any stale processes
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "bun index.ts" 2>/dev/null
sleep 1
rm -f /home/z/my-project/.vote-service.lock

# Start vote-service in background
start_vote() {
  echo "[$(date -Iseconds)] Starting vote-service..." >> "$VOTE_LOG"
  cd "$VOTE_DIR"
  bun index.ts >> "$VOTE_LOG" 2>&1 &
  VOTE_PID=$!
  echo "[$(date -Iseconds)] vote-service pid=$VOTE_PID" >> "$VOTE_LOG"
}

# Start Next.js dev server in background
start_next() {
  echo "[$(date -Iseconds)] Starting Next.js dev server..." >> "$LOG"
  cd "$PROJECT_DIR"
  bun run dev >> "$LOG" 2>&1 &
  NEXT_PID=$!
  echo "[$(date -Iseconds)] next dev pid=$NEXT_PID" >> "$LOG"
}

start_vote
sleep 2
start_next

# Monitor loop: respawn if either dies
while true; do
  sleep 5
  if ! kill -0 $VOTE_PID 2>/dev/null; then
    echo "[$(date -Iseconds)] vote-service died, restarting..." >> "$VOTE_LOG"
    start_vote
  fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then
    echo "[$(date -Iseconds)] next dev died, restarting..." >> "$LOG"
    start_next
  fi
done

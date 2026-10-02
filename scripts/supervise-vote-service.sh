#!/bin/bash
# Supervisor for vote-service: restarts if it dies. Detached from controlling terminal.
LOG=/home/z/my-project/vote-service.log
DIR=/home/z/my-project/mini-services/vote-service

# Drop the --hot reload (which is unstable in this sandbox). Run bun directly.
while true; do
  echo "[$(date -Iseconds)] Starting vote-service (bun index.ts)..." >> "$LOG"
  cd "$DIR"
  bun index.ts >> "$LOG" 2>&1
  EXIT=$?
  echo "[$(date -Iseconds)] vote-service exited with code $EXIT. Restarting in 2s..." >> "$LOG"
  sleep 2
done

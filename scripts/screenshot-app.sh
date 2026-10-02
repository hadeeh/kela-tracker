#!/bin/bash
cd /home/z/my-project
pkill -f "next" 2>/dev/null; pkill -f "bun" 2>/dev/null; pkill -f "supervise" 2>/dev/null
sleep 2
> vote-service.log; > dev-server.log; rm -f .vote-service.lock
setsid nohup bash scripts/supervise-dev.sh > /dev/null 2>&1 < /dev/null &
disown

for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  NEXT_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
  VOTE_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3003/?EIO=4&transport=polling" 2>/dev/null || echo "000")
  if [ "$NEXT_OK" = "200" ] && [ "$VOTE_OK" = "200" ]; then echo "Servers ready"; break; fi
done

# 1. LANDING PAGE
agent-browser cookies clear 2>&1 | tail -1
agent-browser open "http://localhost:81/" 2>&1 | tail -1
sleep 6
agent-browser screenshot /home/z/my-project/download/01-landing.png 2>&1 | tail -1
echo "LANDING SNAPSHOT:"
agent-browser snapshot -i 2>&1 | head -12

# 2. CREATE ROOM
agent-browser find label "Room Name (optional)" fill "Office Kela Circle" 2>&1 | tail -1
agent-browser find label "Your Name" fill "Ali" 2>&1 | tail -1
agent-browser find label "Your Email" fill "ali@host.com" 2>&1 | tail -1
agent-browser find text "Create Room" click 2>&1 | tail -1
sleep 6
agent-browser screenshot /home/z/my-project/download/02-dashboard-empty.png 2>&1 | tail -1
ROOM_URL=$(agent-browser get url 2>&1 | tail -1)
echo "ROOM URL: $ROOM_URL"
echo "DASHBOARD SNAPSHOT:"
agent-browser snapshot -i 2>&1 | head -15

# 3. INVITE DIALOG
agent-browser find text "Invite" click 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/download/03-invite-dialog.png 2>&1 | tail -1
echo "INVITE DIALOG SNAPSHOT:"
agent-browser snapshot -i 2>&1 | head -15

# Close dialog
agent-browser press Escape 2>&1 | tail -1
sleep 1

# Keep alive
exec sleep 100000

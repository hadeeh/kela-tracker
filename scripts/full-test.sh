#!/bin/bash
# Full end-to-end test in one script
cd /home/z/my-project
pkill -f "next" 2>/dev/null; pkill -f "bun" 2>/dev/null; pkill -f "supervise" 2>/dev/null
sleep 2
> vote-service.log; > dev-server.log; rm -f .vote-service.lock
setsid nohup bash scripts/supervise-dev.sh > /dev/null 2>&1 < /dev/null &
disown

# Wait for ready
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  NEXT_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
  if [ "$NEXT_OK" = "200" ]; then echo "Ready after $((i*2))s"; break; fi
done

# Create room + invite friends with different rates
ROOM_DATA=$(curl -s -X POST http://localhost:3000/api/rooms -H "Content-Type: application/json" -d '{"roomName":"Office Kela Circle","hostName":"Ali","hostEmail":"ali@host.com"}')
ROOM_CODE=$(echo "$ROOM_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['room']['code'])")
ALI_ID=$(echo "$ROOM_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['member']['id'])")
BILAL_DATA=$(curl -s -X POST "http://localhost:3000/api/rooms/$ROOM_CODE/members" -H "Content-Type: application/json" -d '{"email":"bilal@f.com","name":"Bilal"}')
BILAL_ID=$(echo "$BILAL_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['member']['id'])")
curl -s -X POST "http://localhost:3000/api/rooms/$ROOM_CODE/rate" -H "Content-Type: application/json" -d "{\"memberId\":\"$BILAL_ID\",\"ratePerKela\":100}" > /dev/null
USMAN_DATA=$(curl -s -X POST "http://localhost:3000/api/rooms/$ROOM_CODE/members" -H "Content-Type: application/json" -d '{"email":"usman@f.com","name":"Usman"}')
USMAN_ID=$(echo "$USMAN_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['member']['id'])")
curl -s -X POST "http://localhost:3000/api/rooms/$ROOM_CODE/rate" -H "Content-Type: application/json" -d "{\"memberId\":\"$USMAN_ID\",\"ratePerKela\":25}" > /dev/null
echo "Room: $ROOM_CODE (Ali=$ALI_ID, Bilal=$BILAL_ID@100, Usman=$USMAN_ID@25)"

# Open browser
agent-browser cookies clear 2>&1 | tail -1
agent-browser open "http://localhost:81/room/$ROOM_CODE" 2>&1 | tail -1
sleep 3
agent-browser eval "localStorage.setItem('kela:$ROOM_CODE', JSON.stringify({memberId:'$ALI_ID', memberName:'Ali', memberEmail:'ali@host.com'}))" 2>&1 | tail -1
agent-browser reload 2>&1 | tail -1
sleep 6

# Wait for socket to connect (online count > 0)
for i in 1 2 3 4 5; do
  sleep 2
  ONLINE=$(agent-browser snapshot 2>&1 | grep -oP '\d+(?= online)' | head -1)
  echo "  Online count: $ONLINE"
  if [ "$ONLINE" = "1" ]; then break; fi
done

# Accuse Bilal
echo "=== ACCUSE BILAL ==="
agent-browser snapshot -i > /tmp/kela-snap.txt 2>&1
ACCUSE_REF=$(grep -B1 "Kelaaaa" /tmp/kela-snap.txt | head -1 | grep -oP '@e\d+')
echo "Accuse button ref: $ACCUSE_REF"
agent-browser click $ACCUSE_REF 2>&1 | tail -1
sleep 2

# Fill reason and start vote
agent-browser find label "Reason (optional)" fill "got offended at cricket joke" 2>&1 | tail -1
sleep 1
# Click start vote
agent-browser snapshot -i > /tmp/kela-snap2.txt 2>&1
START_REF=$(grep -B1 "Start Vote" /tmp/kela-snap2.txt | head -1 | grep -oP '@e\d+')
echo "Start vote ref: $START_REF"
agent-browser click $START_REF 2>&1 | tail -1
sleep 5

# Check if vote modal appeared
echo "=== VOTE MODAL ==="
agent-browser snapshot -i > /tmp/kela-snap3.txt 2>&1
cat /tmp/kela-snap3.txt | head -15

# Find and click Kelaaaa vote button
KELA_REF=$(grep -B1 "Kelaaaa" /tmp/kela-snap3.txt | head -1 | grep -oP '@e\d+')
echo "Kela vote ref: $KELA_REF"
if [ -n "$KELA_REF" ]; then
  agent-browser click $KELA_REF 2>&1 | tail -1
  sleep 5
fi

echo "=== AFTER VOTE ==="
agent-browser snapshot 2>&1 | head -30
echo "=== VOTE LOG ==="
tail -5 vote-service.log

# Reload to clear any stuck modal and see final state
echo "=== RELOAD AND CHECK LEADERBOARD ==="
agent-browser reload 2>&1 | tail -1
sleep 5
agent-browser snapshot 2>&1 | grep -E "Leaderboard|Kelaaaa|Kelas eaten|Fine due|guilty|🥇|🥈|🥉|Bilal|Usman|Ali" | head -30

echo ""
echo "=== DB CHECK ==="
curl -s "http://localhost:3000/api/rooms/$ROOM_CODE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'Room: {d[\"room\"][\"name\"]}')
print(f'Members: {len(d[\"members\"])}')
for m in d['members']:
    guilty = len([i for i in d['incidents'] if i['user']['id'] == m['id'] and i['verdict'] == 'kela'])
    fine = guilty * m['ratePerKela']
    print(f'  - {m[\"name\"]}: {guilty} kelas, PKR {m[\"ratePerKela\"]}/kela, fine=PKR {fine}')
print(f'Incidents: {len(d[\"incidents\"])}')
for i in d['incidents']:
    print(f'  - {i[\"user\"][\"name\"]} accused by {i[\"accusedBy\"][\"name\"]}: verdict={i[\"verdict\"]} yes={i[\"votesYes\"]} no={i[\"votesNo\"]}')
"

# Keep servers alive
exec sleep 100000

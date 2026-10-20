#!/bin/bash
# Generates all Kela Tracker sounds using z-ai TTS (male voice, WAV format).
# Style: short, punchy, announcement-style alerts.
#
# Usage:  bash /home/z/my-project/scripts/generate-sounds.sh
# Output: /home/z/my-project/public/sounds/*.wav

set -e

OUT_DIR="/home/z/my-project/public/sounds"
mkdir -p "$OUT_DIR"

# Each line: <filename>|<text>|<speed>
# Speed: 0.8 = slower/dramatic, 1.0 = normal, 1.2 = faster/urgent
SOUNDS=(
  # ============ VOTING LIFECYCLE ============
  # Short, urgent alert when a vote begins
  "vote-start.wav|Kela spotted!|1.15"
  # Confirmation chimes when a member casts their vote
  "kela-vote.wav|Kela!|1.1"
  "saeb-vote.wav|Saeb!|1.1"
  # Verdict announcements when voting closes
  "result-kela.wav|Guilty! Kela confirmed.|0.95"
  "result-saeb.wav|Innocent! False alarm.|1.0"
  "result-tie.wav|It's a tie!|1.0"

  # ============ WALK OF SHAME ============
  # Triggered when someone eats 3+ kelas in a single day
  "walk-of-shame.wav|Walk of shame! Three kelas in one day!|0.9"

  # ============ EATER BADGES (shame tier unlocks) ============
  "badge-rookie.wav|Rookie kela eater unlocked!|1.05"
  "badge-starter.wav|Kela regular unlocked!|1.05"
  "badge-bronze.wav|Bronze! Kela boss unlocked!|0.95"
  "badge-silver.wav|Silver! Kela sultan unlocked!|0.95"
  "badge-gold.wav|Gold! Kela emperor unlocked!|0.9"
  "badge-platinum.wav|Platinum! Kela legend unlocked!|0.9"
  "badge-diamond.wav|Diamond! Kela godfather unlocked!|0.85"
)

echo "=========================================="
echo "  Generating ${#SOUNDS[@]} sounds → $OUT_DIR"
echo "  Voice: male"
echo "=========================================="

i=0
for entry in "${SOUNDS[@]}"; do
  i=$((i + 1))
  filename="${entry%%|*}"
  rest="${entry#*|}"
  text="${rest%%|*}"
  speed="${rest##*|}"

  out="$OUT_DIR/$filename"
  echo ""
  echo "[$i/${#SOUNDS[@]}] $filename"
  echo "  text:  $text"
  echo "  speed: $speed"

  # Retry up to 4 times on rate-limit (429) with increasing backoff
  attempt=0
  max_attempts=4
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    if z-ai tts \
        --input "$text" \
        --output "$out" \
        --voice male \
        --speed "$speed" \
        --format wav 2>&1 | tail -3 | grep -q "completed\|saved"; then
      break
    fi
    if [ $attempt -lt $max_attempts ]; then
      wait_sec=$((attempt * 30))
      echo "  ⏳ rate-limited, waiting ${wait_sec}s before retry $attempt/$max_attempts..."
      sleep $wait_sec
    fi
  done

  if [ -f "$out" ] && [ $(stat -c%s "$out") -gt 1000 ]; then
    size=$(stat -c%s "$out")
    echo "  ✅ saved ($size bytes)"
  else
    echo "  ❌ FAILED — no file produced after $max_attempts attempts"
  fi
done

echo ""
echo "=========================================="
echo "  Done. Generated files:"
ls -la "$OUT_DIR"/*.wav | awk '{printf "  %s  %s bytes\n", $NF, $5}'
echo "=========================================="

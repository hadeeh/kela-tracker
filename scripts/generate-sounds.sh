#!/bin/bash
# Generates all Kela Tracker sounds using z-ai TTS (tongtong voice, WAV format).
# Style: short, punchy, game-announcement style — like PUBG "Enemy spotted".
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
  # PUBG "Enemy spotted" style — short, urgent alert when a vote begins
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
echo "  Voice: tongtong (default)"
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

  z-ai tts \
    --input "$text" \
    --output "$out" \
    --voice tongtong \
    --speed "$speed" \
    --format wav 2>&1 | tail -3

  if [ -f "$out" ]; then
    size=$(stat -c%s "$out")
    echo "  ✅ saved ($size bytes)"
  else
    echo "  ❌ FAILED — no file produced"
  fi
done

echo ""
echo "=========================================="
echo "  Done. Generated files:"
ls -la "$OUT_DIR"/*.wav | awk '{printf "  %s  %s bytes\n", $NF, $5}'
echo "=========================================="

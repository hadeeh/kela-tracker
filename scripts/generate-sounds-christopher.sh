#!/bin/bash
# Regenerates all Kela Tracker sounds using edge-tts (Microsoft Edge neural TTS).
# Voice: en-US-ChristopherNeural — "Reliable, Authority" male news anchor.
#
# This is built-in neural TTS (NOT a voice clone), so it has zero background noise
# or musical-noise artifacts. No noise cleanup needed.
#
# After generation, applies a comedic "boom" kick on the punchline (like a meme stinger).
#
# Usage:  bash /home/z/my-project/scripts/generate-sounds-christopher.sh

set -e

OUT_DIR="/home/z/my-project/public/sounds"
mkdir -p "$OUT_DIR"
TMP_DIR="/tmp/edge-tts-out"
mkdir -p "$TMP_DIR"

VOICE="en-US-ChristopherNeural"

# Per-sound config: <filename>|<text>|<rate>|<kick_delay_ms>|<kick_freq_hz>|<kick_volume>
# rate:        edge-tts speed adjustment ("-10%" slower, "+15%" faster)
# kick_delay:  ms after start when boom plays (0 = no kick)
# kick_freq:   boom frequency in Hz (lower = deeper)
# kick_vol:    boom volume 0-1
SOUNDS=(
  # ============ VOTING LIFECYCLE ============
  "vote-start.wav|Kela spotted.|-5%|400|70|0.6"
  "kela-vote.wav|Kela.|+5%|100|90|0.5"
  "saeb-vote.wav|Saeb.|+5%|100|110|0.5"
  "result-kela.wav|Guilty. Kela confirmed.|-10%|700|60|0.7"
  "result-saeb.wav|Innocent. False alarm.|-5%|600|120|0.4"
  "result-tie.wav|It's a tie.|+0%|300|150|0.4"

  # ============ WALK OF SHAME ============
  "walk-of-shame.wav|Walk of shame. Three kelas in one day.|-15%|1800|50|0.7"

  # ============ EATER BADGES ============
  "badge-rookie.wav|Rookie kela eater, unlocked.|-5%|600|80|0.5"
  "badge-starter.wav|Kela regular, unlocked.|-5%|500|80|0.5"
  "badge-bronze.wav|Bronze. Kela boss, unlocked.|-10%|700|70|0.6"
  "badge-silver.wav|Silver. Kela sultan, unlocked.|-10%|700|65|0.6"
  "badge-gold.wav|Gold. Kela emperor, unlocked.|-15%|800|60|0.7"
  "badge-platinum.wav|Platinum. Kela legend, unlocked.|-20%|900|55|0.7"
  "badge-diamond.wav|Diamond. Kela godfather, unlocked.|-25%|1000|50|0.8"
)

echo "=========================================="
echo "  Generating ${#SOUNDS[@]} sounds with $VOICE"
echo "  (Built-in neural TTS — zero background noise)"
echo "=========================================="

i=0
for entry in "${SOUNDS[@]}"; do
  i=$((i + 1))
  IFS='|' read -r filename text rate kick_delay kick_freq kick_vol <<< "$entry"

  raw_mp3="$TMP_DIR/$filename.mp3"
  raw_wav="$TMP_DIR/$filename.raw.wav"
  out="$OUT_DIR/$filename"

  echo ""
  echo "[$i/${#SOUNDS[@]}] $filename"
  echo "  text:  $text  | rate: $rate | kick: ${kick_delay}ms @ ${kick_freq}Hz vol ${kick_vol}"

  # Generate speech with edge-tts
  attempt=0
  max_attempts=3
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    if edge-tts --voice "$VOICE" --text "$text" --write-media "$raw_mp3" --rate="$rate" 2>&1 | tail -1 > /dev/null; then
      if [ -f "$raw_mp3" ] && [ $(stat -c%s "$raw_mp3") -gt 500 ]; then
        break
      fi
    fi
    sleep $((attempt * 5))
  done

  if [ ! -f "$raw_mp3" ] || [ $(stat -c%s "$raw_mp3") -lt 500 ]; then
    echo "  ❌ TTS generation failed"
    continue
  fi

  # Convert to WAV 22050Hz mono (NO noise cleanup needed — edge-tts is artifact-free)
  ffmpeg -y -i "$raw_mp3" -ar 22050 -ac 1 "$raw_wav" 2>&1 | tail -1 > /dev/null

  # Add comedic kick (with fade-in to kill click transient)
  if [ "$kick_delay" -gt 0 ]; then
    kick_dur=0.5
    ffmpeg -y -i "$raw_wav" \
      -f lavfi -t "$kick_dur" -i "sine=frequency=${kick_freq}:duration=${kick_dur}" \
      -filter_complex "[1:a]afade=t=in:st=0:d=0.02,volume=${kick_vol},afade=t=out:st=0.05:d=0.45,adelay=${kick_delay}|${kick_delay}[boom];[0:a][boom]amix=inputs=2:duration=first:weights=1 0.9,alimiter=limit=0.92" \
      "$out" 2>&1 | tail -1 > /dev/null
  else
    ffmpeg -y -i "$raw_wav" -af "alimiter=limit=0.92" "$out" 2>&1 | tail -1 > /dev/null
  fi

  rm -f "$raw_mp3" "$raw_wav"

  if [ -f "$out" ]; then
    size=$(stat -c%s "$out")
    echo "  ✅ saved ($size bytes)"
  else
    echo "  ❌ FAILED"
  fi
done

echo ""
echo "=========================================="
echo "  Done. Generated files:"
ls -la "$OUT_DIR"/*.wav | awk '{printf "  %s  %s bytes\n", $NF, $5}'
echo "=========================================="

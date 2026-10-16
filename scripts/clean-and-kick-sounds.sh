#!/bin/bash
# Processes all Kela Tracker sounds: removes background noise + adds a comedic "kick"
# (boom impact on the punchline word, like a meme beat-drop).
#
# Reads:  /home/z/my-project/public/sounds/*.wav  (Attenborough voice, raw from Fish Audio)
# Writes: /home/z/my-project/public/sounds/*.wav  (overwritten with cleaned + kicked versions)
# Backup: /home/z/my-project/public/sounds/raw-backup/  (originals saved before processing)
#
# Pipeline per sound:
#   1. High-pass 80Hz + low-pass 8kHz  → trim band to voice range
#   2. afftdn (nr=8, no tracking)      → VERY gentle static noise reduction
#                                         (avoid tn=1 which causes musical noise / screeching)
#   3. agate (gentle)                   → silence background between words
#   4. acompressor (soft)               → even out volume
#   5. volume                            → moderate boost
#   6. alimiter                          → prevent clipping
#   7. Comedic kick: synth a short boom with FADE-IN (no click) + FADE-OUT, mixed at punchline
#
# Usage:  bash /home/z/my-project/scripts/clean-and-kick-sounds.sh

set -e

SOUNDS_DIR="/home/z/my-project/public/sounds"
BACKUP_DIR="$SOUNDS_DIR/raw-backup"
mkdir -p "$BACKUP_DIR"

# Per-sound config: <filename>|<kick_delay_ms>|<kick_freq_hz>|<kick_volume>
# kick_delay_ms = when to play the boom (after sound start). 0 = no kick.
# kick_freq_hz  = boom frequency (lower = deeper). 60-100 typical.
# kick_volume   = relative volume of the kick (0.3 = subtle, 0.7 = loud meme)
SOUNDS=(
  "vote-start.wav|400|70|0.6"
  "kela-vote.wav|100|90|0.5"
  "saeb-vote.wav|100|110|0.5"
  "result-kela.wav|700|60|0.7"
  "result-saeb.wav|600|120|0.4"
  "result-tie.wav|300|150|0.4"
  "walk-of-shame.wav|1800|50|0.7"
  "badge-rookie.wav|600|80|0.5"
  "badge-starter.wav|500|80|0.5"
  "badge-bronze.wav|700|70|0.6"
  "badge-silver.wav|700|65|0.6"
  "badge-gold.wav|800|60|0.7"
  "badge-platinum.wav|900|55|0.7"
  "badge-diamond.wav|1000|50|0.8"
)

echo "=========================================="
echo "  Cleaning + kicking ${#SOUNDS[@]} sounds"
echo "=========================================="

i=0
for entry in "${SOUNDS[@]}"; do
  i=$((i + 1))
  filename="${entry%%|*}"
  rest="${entry#*|}"
  kick_delay="${rest%%|*}"
  rest="${rest#*|}"
  kick_freq="${rest%%|*}"
  kick_vol="${rest##*|}"

  src="$SOUNDS_DIR/$filename"
  backup="$BACKUP_DIR/$filename"
  cleaned_tmp="/tmp/cleaned-$filename"
  out="$src"

  if [ ! -f "$src" ]; then
    echo "[$i/${#SOUNDS[@]}] ⚠️  $filename not found, skipping"
    continue
  fi

  echo ""
  echo "[$i/${#SOUNDS[@]}] $filename  (kick: ${kick_delay}ms @ ${kick_freq}Hz, vol ${kick_vol})"

  # Backup original (only first time)
  if [ ! -f "$backup" ]; then
    cp "$src" "$backup"
  fi

  # === Stage 1: Noise reduction + cleanup (gentle, no musical-noise artifacts) ===
  # Key: do NOT use afftdn with tn=1 (noise tracking) — it causes screechy musical noise on speech.
  # Instead: light static FFT denoise + gate to silence background between words.
  ffmpeg -y -i "$src" \
    -af "highpass=f=80,lowpass=f=8000,adeclick,afftdn=nr=8:nf=-40,agate=threshold=0.025:range=0.7:attack=15:release=250,acompressor=threshold=0.2:ratio=3:attack=20:release=200:makeup=1.5,volume=1.2,alimiter=limit=0.95" \
    "$cleaned_tmp" 2>&1 | tail -1 > /dev/null

  # === Stage 2: Add comedic kick (if delay > 0) ===
  if [ "$kick_delay" -gt 0 ]; then
    # Generate a short boom: low-frequency sine with FADE-IN (kills click transient)
    # + exponential FADE-OUT for natural decay
    kick_dur=0.5
    kick_delay_sec=$(python3 -c "print($kick_delay / 1000)")

    ffmpeg -y -i "$cleaned_tmp" \
      -f lavfi -t "$kick_dur" -i "sine=frequency=${kick_freq}:duration=${kick_dur}" \
      -filter_complex "[1:a]afade=t=in:st=0:d=0.02,volume=${kick_vol},afade=t=out:st=0.05:d=0.45,adelay=${kick_delay}|${kick_delay}[kick];[0:a][kick]amix=inputs=2:duration=first:weights=1 0.9,alimiter=limit=0.92" \
      "$out" 2>&1 | tail -1 > /dev/null
  else
    # No kick — just apply final limiter to cleaned audio
    ffmpeg -y -i "$cleaned_tmp" \
      -af "alimiter=limit=0.92" \
      "$out" 2>&1 | tail -1 > /dev/null
  fi

  rm -f "$cleaned_tmp"

  if [ -f "$out" ]; then
    size=$(stat -c%s "$out")
    echo "  ✅ saved ($size bytes)"
  else
    echo "  ❌ FAILED"
  fi
done

echo ""
echo "=========================================="
echo "  Done. Originals backed up to:"
echo "  $BACKUP_DIR"
echo ""
echo "  Final files:"
ls -la "$SOUNDS_DIR"/*.wav | grep -v raw-backup | awk '{printf "  %s  %s bytes\n", $NF, $5}'
echo "=========================================="

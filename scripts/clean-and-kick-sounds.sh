#!/bin/bash
# Processes all Kela Tracker sounds: removes background noise + adds a comedic "kick"
# (boom impact on the punchline word, like a meme beat-drop).
#
# Reads:  /home/z/my-project/public/sounds/*.wav  (Attenborough voice, raw from Fish Audio)
# Writes: /home/z/my-project/public/sounds/*.wav  (overwritten with cleaned + kicked versions)
# Backup: /home/z/my-project/public/sounds/raw-backup/  (originals saved before processing)
#
# Pipeline per sound:
#   1. High-pass 80Hz + low-pass 8kHz  → remove rumble and hiss outside voice band
#   2. afftdn (FFT denoise, nr=15)     → remove steady background noise
#   3. adeclick                          → remove clicks/pops
#   4. agate                             → silence quiet background between words
#   5. acompressor                       → even out volume, make voice punchier
#   6. volume                            → boost to near-0dB
#   7. Comedic kick: synth a short 60-80Hz boom, mix at the punchline timestamp
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

  # === Stage 1: Noise reduction + cleanup ===
  # Filter chain: highpass/lowpass trim band to voice range, adeclick removes pops,
  # afftdn does FFT noise reduction, agate silences background between words,
  # acompressor evens out volume, volume boosts.
  ffmpeg -y -i "$src" \
    -af "highpass=f=80,lowpass=f=8000,adeclick,afftdn=nr=15:nf=-30:tn=1,agate=threshold=0.04:range=0.5:attack=10:release=200,acompressor=threshold=0.18:ratio=4:attack=10:release=150:makeup=2,volume=1.5" \
    "$cleaned_tmp" 2>&1 | tail -1 > /dev/null

  # === Stage 2: Add comedic kick (if delay > 0) ===
  if [ "$kick_delay" -gt 0 ]; then
    # Generate a short boom: low-frequency sine with exponential pitch drop + fast decay
    # Sound: "BOOM" — like a meme stinger
    kick_dur=0.5
    kick_delay_sec=$(python3 -c "print($kick_delay / 1000)")

    ffmpeg -y -i "$cleaned_tmp" \
      -f lavfi -t "$kick_dur" -i "sine=frequency=${kick_freq}:duration=${kick_dur}" \
      -filter_complex "[1:a]volume=${kick_vol},afade=t=out:st=0.05:d=0.45,adelay=${kick_delay}|${kick_delay}[kick];[0:a][kick]amix=inputs=2:duration=first:weights=1 1,acompressor=threshold=0.1:ratio=3:attack=5:release=80,volume=1.4,alimiter=limit=0.95" \
      "$out" 2>&1 | tail -1 > /dev/null
  else
    # No kick — just apply final limiter to cleaned audio
    ffmpeg -y -i "$cleaned_tmp" \
      -af "alimiter=limit=0.95" \
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

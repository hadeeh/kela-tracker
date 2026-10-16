#!/bin/bash
# Generates all Kela Tracker sounds using David Attenborough's voice via Fish Audio API.
#
# PREREQ: Get a free Fish Audio API key:
#   1. Go to https://fish.audio/auth/signup
#   2. Sign up (no credit card needed)
#   3. Visit https://fish.audio/app/api-keys/ and create an API key
#   4. Export it as an env var before running this script:
#        export FISH_AUDIO_API_KEY="your-key-here"
#        bash /home/z/my-project/scripts/generate-sounds-attenborough.sh
#
# Voice model: c39a76f685cf4f8fb41cd5d3d66b497d (David Attenborough)
# Engine: s2.1-pro-free (free tier, unlimited under fair use)
# Output: /home/z/my-project/public/sounds/*.wav

set -e

if [ -z "$FISH_AUDIO_API_KEY" ]; then
  echo "❌ ERROR: FISH_AUDIO_API_KEY environment variable not set."
  echo "   Get a free key at https://fish.audio/auth/signup then:"
  echo "   export FISH_AUDIO_API_KEY=\"your-key-here\""
  exit 1
fi

OUT_DIR="/home/z/my-project/public/sounds"
mkdir -p "$OUT_DIR"
TMP_DIR="/tmp/fish-audio-out"
mkdir -p "$TMP_DIR"

VOICE_ID="c39a76f685cf4f8fb41cd5d3d66b497d"  # David Attenborough
MODEL="s2.1-pro-free"

# Each line: <filename>|<text>|<speed>
# Speed: 0.7 = slow/documentary, 1.0 = normal, 1.2 = faster/urgent
SOUNDS=(
  # ============ VOTING LIFECYCLE ============
  "vote-start.wav|Kela spotted.|0.9"
  "kela-vote.wav|Kela.|1.0"
  "saeb-vote.wav|Saeb.|1.0"
  "result-kela.wav|Guilty. Kela confirmed.|0.85"
  "result-saeb.wav|Innocent. False alarm.|0.9"
  "result-tie.wav|It's a tie.|0.95"

  # ============ WALK OF SHAME ============
  "walk-of-shame.wav|Walk of shame. Three kelas in one day.|0.8"

  # ============ EATER BADGES (tier unlocks) ============
  "badge-rookie.wav|Rookie kela eater, unlocked.|0.9"
  "badge-starter.wav|Kela regular, unlocked.|0.9"
  "badge-bronze.wav|Bronze. Kela boss, unlocked.|0.85"
  "badge-silver.wav|Silver. Kela sultan, unlocked.|0.85"
  "badge-gold.wav|Gold. Kela emperor, unlocked.|0.8"
  "badge-platinum.wav|Platinum. Kela legend, unlocked.|0.75"
  "badge-diamond.wav|Diamond. Kela godfather, unlocked.|0.7"
)

echo "=========================================="
echo "  Generating ${#SOUNDS[@]} sounds with David Attenborough voice"
echo "  Voice ID: $VOICE_ID"
echo "  Engine:   $MODEL (free tier)"
echo "=========================================="

i=0
for entry in "${SOUNDS[@]}"; do
  i=$((i + 1))
  filename="${entry%%|*}"
  rest="${entry#*|}"
  text="${rest%%|*}"
  speed="${rest##*|}"

  out_mp3="$TMP_DIR/$filename.mp3"
  out_wav="$OUT_DIR/$filename"

  echo ""
  echo "[$i/${#SOUNDS[@]}] $filename"
  echo "  text:  $text"
  echo "  speed: $speed"

  # Call Fish Audio API
  attempt=0
  max_attempts=4
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    http_code=$(curl -s -w "%{http_code}" -o "$out_mp3" -X POST 'https://api.fish.audio/v1/tts' \
      -H "Authorization: Bearer $FISH_AUDIO_API_KEY" \
      -H "Content-Type: application/json" \
      -H "model: $MODEL" \
      --data-raw "{\"text\":\"$text\",\"reference_id\":\"$VOICE_ID\",\"format\":\"mp3\",\"prosody\":{\"speed\":$speed,\"volume\":0,\"normalize_loudness\":true},\"chunk_length\":300,\"normalize\":true,\"latency\":\"normal\"}")

    if [ "$http_code" = "200" ] && [ -f "$out_mp3" ] && [ $(stat -c%s "$out_mp3") -gt 1000 ]; then
      break
    fi
    echo "  ⚠️ HTTP $http_code (attempt $attempt/$max_attempts)"
    if [ $attempt -lt $max_attempts ]; then
      wait_sec=$((attempt * 20))
      echo "  ⏳ waiting ${wait_sec}s before retry..."
      sleep $wait_sec
    fi
  done

  if [ "$http_code" = "200" ] && [ -f "$out_mp3" ] && [ $(stat -c%s "$out_mp3") -gt 1000 ]; then
    # Convert mp3 → wav (mono, 22050Hz) for consistency with existing sounds
    ffmpeg -y -i "$out_mp3" -ar 22050 -ac 1 "$out_wav" 2>&1 | tail -1 > /dev/null
    rm -f "$out_mp3"
    size=$(stat -c%s "$out_wav")
    echo "  ✅ saved ($size bytes)"
  else
    echo "  ❌ FAILED after $max_attempts attempts (HTTP $http_code)"
    [ -f "$out_mp3" ] && cat "$out_mp3" | head -c 300
    rm -f "$out_mp3"
  fi
done

echo ""
echo "=========================================="
echo "  Done. Generated files:"
ls -la "$OUT_DIR"/*.wav | awk '{printf "  %s  %s bytes\n", $NF, $5}'
echo "=========================================="

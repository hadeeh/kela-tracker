"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SoundName =
  | "vote-start" | "kela-vote" | "saeb-vote"
  | "result-kela" | "result-saeb" | "result-tie"
  | "badge-rookie" | "badge-starter" | "badge-bronze" | "badge-silver"
  | "badge-gold" | "badge-platinum" | "badge-diamond";

const DEFAULT_SOUND_FILES: Record<SoundName, string> = {
  "vote-start":       "/sounds/vote-start.wav",
  "kela-vote":        "/sounds/kela-vote.wav",
  "saeb-vote":        "/sounds/saeb-vote.wav",
  "result-kela":      "/sounds/result-kela.wav",
  "result-saeb":      "/sounds/result-saeb.wav",
  "result-tie":       "/sounds/result-tie.wav",
  "badge-rookie":     "/sounds/badge-rookie.wav",
  "badge-starter":    "/sounds/badge-starter.wav",
  "badge-bronze":     "/sounds/badge-bronze.wav",
  "badge-silver":     "/sounds/badge-silver.wav",
  "badge-gold":       "/sounds/badge-gold.wav",
  "badge-platinum":   "/sounds/badge-platinum.wav",
  "badge-diamond":    "/sounds/badge-diamond.wav",
};

// All sound types that can be customized by the minister
export const UPLOADABLE_SOUNDS: SoundName[] = [
  "vote-start", "kela-vote", "saeb-vote", "result-kela",
  "badge-rookie", "badge-starter", "badge-bronze", "badge-silver",
  "badge-gold", "badge-platinum", "badge-diamond",
];

// Singleton audio element pool — reuses the same <audio> per sound for snappy playback.
let audioPool: Partial<Record<string, HTMLAudioElement>> = {};
let unlocked = false;

// Custom sounds map: soundType -> URL (room-specific)
let customSounds: Partial<Record<string, string>> = {};

function getAudioUrl(name: SoundName): string {
  // Check for custom sound first (only for the 3 uploadable types)
  if (customSounds[name]) return customSounds[name]!;
  return DEFAULT_SOUND_FILES[name];
}

function getAudio(name: SoundName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const url = getAudioUrl(name);
  // Use URL as key so custom sounds get their own audio element
  const key = `${name}:${url}`;
  let a = audioPool[key];
  if (!a) {
    a = new Audio(url);
    a.preload = "auto";
    audioPool[key] = a;
  }
  return a;
}

// Some browsers block autoplay until a user gesture. Call this on the first
// user interaction anywhere in the app to "unlock" audio.
export function useSoundUnlock() {
  useEffect(() => {
    if (unlocked) return;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
      } catch {}
      // Preload all default sounds.
      (Object.keys(DEFAULT_SOUND_FILES) as SoundName[]).forEach((s) => {
        const a = getAudio(s);
        a?.load();
      });
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

// Hook to load custom sounds for a room
export function useRoomSounds(roomCode: string | null) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/sounds`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const sounds = data.sounds as Record<string, string | null>;
        const uploadable = UPLOADABLE_SOUNDS;
        for (const t of uploadable) {
          if (sounds[t]) {
            customSounds[t] = `${sounds[t]}?t=${Date.now()}`;
          } else {
            delete customSounds[t];
          }
          // Clear cached audio elements for this sound type
          for (const key of Object.keys(audioPool)) {
            if (key.startsWith(t + ":")) {
              delete audioPool[key];
            }
          }
        }
      } catch {}
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [roomCode]);

  return loaded;
}

// Refresh room sounds (call after uploading a new sound)
export function refreshRoomSounds(roomCode: string) {
  const uploadable = UPLOADABLE_SOUNDS;
  for (const t of uploadable) {
    for (const key of Object.keys(audioPool)) {
      if (key.startsWith(t + ":")) {
        delete audioPool[key];
      }
    }
  }
  fetch(`/api/rooms/${roomCode}/sounds`, { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      const sounds = data.sounds as Record<string, string | null>;
      for (const t of uploadable) {
        if (sounds[t]) {
          customSounds[t] = `${sounds[t]}?t=${Date.now()}`;
        } else {
          delete customSounds[t];
        }
      }
    })
    .catch(() => {});
}

export function useSounds() {
  useSoundUnlock();
  const play = useCallback((name: SoundName) => {
    const a = getAudio(name);
    if (!a) return;
    a.currentTime = 0;
    a.volume = 1;
    const p = a.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {/* autoplay blocked — ignore; will play next time after unlock */});
    }
  }, []);
  return { play };
}

"use client";

import { useCallback, useEffect, useRef } from "react";

export type SoundName =
  | "vote-start"
  | "kela-vote"
  | "saeb-vote"
  | "result-kela"
  | "result-saeb"
  | "result-tie";

const SOUND_FILES: Record<SoundName, string> = {
  "vote-start":   "/sounds/vote-start.wav",
  "kela-vote":    "/sounds/kela-vote.wav",
  "saeb-vote":    "/sounds/saeb-vote.wav",
  "result-kela":  "/sounds/result-kela.wav",
  "result-saeb":  "/sounds/result-saeb.wav",
  "result-tie":   "/sounds/result-tie.wav",
};

// Singleton audio element pool — reuses the same <audio> per sound for snappy playback.
let audioPool: Partial<Record<SoundName, HTMLAudioElement>> = {};
let unlocked = false;

function getAudio(name: SoundName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let a = audioPool[name];
  if (!a) {
    a = new Audio(SOUND_FILES[name]);
    a.preload = "auto";
    audioPool[name] = a;
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
      // Play a silent dummy to satisfy autoplay policies.
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
      // Preload all sounds.
      (Object.keys(SOUND_FILES) as SoundName[]).forEach((s) => {
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

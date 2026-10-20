"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  /** Name of the accused person (shown under the emoji) */
  accusedName: string;
  /** Current kela (yes) vote count */
  votesYes: number;
  /** Current saeb (no) vote count */
  votesNo: number;
  /** Whether the user has already voted (controls hint text) */
  hasVoted: boolean;
  /** Whether voting is closed (stops the sweep animation) */
  closed?: boolean;
};

type Blink = {
  id: number;
  choice: "kela" | "saeb";
  // position on radar in polar coords (angle in deg, radius in % of radar)
  angle: number;
  radius: number; // 30-85 (inside the radar ring)
};

/**
 * Kela Radar — PUBG-style radar visualization of an active vote.
 *
 * The accused person's avatar emoji sits in the center. A radar sweep
 * rotates around. When a vote comes in, that vote's emoji (🍌 or 🍎)
 * pops onto the radar as a bubble at a random angle/radius.
 *
 * Each vote gets its own unique blink slot, so as votes accumulate the
 * radar fills up with banana/apple bubbles around the accused.
 *
 * Pure presentational component — no API calls.
 */
export function KelaRadar({ accusedName, votesYes, votesNo, hasVoted, closed }: Props) {
  const [blinks, setBlinks] = useState<Blink[]>([]);
  // Track previous counts to detect new votes coming in
  const prevYes = useRef(votesYes);
  const prevNo = useRef(votesNo);
  const blinkIdRef = useRef(0);

  // Total votes ever — used so each vote gets a permanent blink slot.
  // We track the max so removing votes (shouldn't happen but defensive) doesn't break things.
  const totalVotesSeen = useRef(0);

  useEffect(() => {
    const newYes = Math.max(0, votesYes - prevYes.current);
    const newNo = Math.max(0, votesNo - prevNo.current);

    if (newYes > 0 || newNo > 0) {
      const additions: Blink[] = [];
      for (let i = 0; i < newYes; i++) {
        blinkIdRef.current += 1;
        // Stable angle/radius based on the vote sequence number so each
        // vote has a unique deterministic position (no fl::cker on rerender).
        const seq = totalVotesSeen.current + i;
        additions.push({
          id: blinkIdRef.current,
          choice: "kela",
          angle: (seq * 137.5) % 360, // golden-angle distribution
          radius: 35 + ((seq * 13) % 45), // 35-79%
        });
      }
      for (let i = 0; i < newNo; i++) {
        blinkIdRef.current += 1;
        const seq = totalVotesSeen.current + newYes + i;
        additions.push({
          id: blinkIdRef.current,
          choice: "saeb",
          angle: (seq * 137.5) % 360,
          radius: 35 + ((seq * 17) % 45),
        });
      }
      totalVotesSeen.current += newYes + newNo;
      setBlinks((prev) => [...prev, ...additions]);
    }

    prevYes.current = votesYes;
    prevNo.current = votesNo;
  }, [votesYes, votesNo]);

  // Reset blinks when the accused person changes (new vote session)
  const prevAccused = useRef(accusedName);
  useEffect(() => {
    if (prevAccused.current !== accusedName) {
      setBlinks([]);
      totalVotesSeen.current = 0;
      prevYes.current = 0;
      prevNo.current = 0;
      prevAccused.current = accusedName;
    }
  }, [accusedName]);

  // Compute x/y from polar coords (center = 50%, 50%)
  function polarToXY(angleDeg: number, radiusPct: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180); // 0deg = top
    const x = 50 + radiusPct * Math.cos(rad);
    const y = 50 + radiusPct * Math.sin(rad);
    return { x, y };
  }

  // Pick emoji for accused based on first letter of name (deterministic)
  const accusedEmoji = useMemo(() => {
    const emojis = ["😮", "😨", "😬", "😱", "🫣", "😳", "perspir"];
    const code = accusedName.charCodeAt(0) || 0;
    return emojis[code % emojis.length];
  }, [accusedName]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-48 h-48 sm:w-56 sm:h-56">
        {/* Radar background (concentric rings) */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <defs>
            <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a3d2e" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#051a14" stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id="sweep-grad" x1="50%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Outer circle (radar background) */}
          <circle cx="50" cy="50" r="48" fill="url(#radar-bg)" stroke="#22c55e" strokeWidth="0.8" strokeOpacity="0.6" />

          {/* Concentric rings */}
          <circle cx="50" cy="50" r="36" fill="none" stroke="#22c55e" strokeWidth="0.4" strokeOpacity="0.35" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#22c55e" strokeWidth="0.4" strokeOpacity="0.35" />
          <circle cx="50" cy="50" r="12" fill="none" stroke="#22c55e" strokeWidth="0.4" strokeOpacity="0.35" />

          {/* Cross hairs */}
          <line x1="50" y1="2" x2="50" y2="98" stroke="#22c55e" strokeWidth="0.3" strokeOpacity="0.3" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="#22c55e" strokeWidth="0.3" strokeOpacity="0.3" />
          <line x1="15.6" y1="15.6" x2="84.4" y2="84.4" stroke="#22c55e" strokeWidth="0.25" strokeOpacity="0.2" />
          <line x1="84.4" y1="15.6" x2="15.6" y2="84.4" stroke="#22c55e" strokeWidth="0.25" strokeOpacity="0.2" />

          {/* Radar sweep (rotating sector) */}
          {!closed && (
            <g className="kela-radar-sweep">
              <path
                d="M 50 50 L 98 50 A 48 48 0 0 0 73.6 8.6 Z"
                fill="url(#sweep-grad)"
              />
              <line x1="50" y1="50" x2="98" y2="50" stroke="#22c55e" strokeWidth="0.6" strokeOpacity="0.9" />
            </g>
          )}
        </svg>

        {/* Center: accused person emoji */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <div className="text-3xl sm:text-4xl drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse">
            {accusedEmoji}
          </div>
          <div className="text-[9px] sm:text-[10px] text-green-300 font-bold mt-0.5 max-w-[60px] truncate text-center">
            {accusedName}
          </div>
        </div>

        {/* Vote blinks (rendered as absolutely-positioned divs over the SVG) */}
        {blinks.map((b) => {
          const { x, y } = polarToXY(b.angle, b.radius);
          return (
            <div
              key={b.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 kela-radar-bubble"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                // Stagger the bubble-pop animation by 100ms per vote index
                animationDelay: `${(b.id % 8) * 80}ms`,
              }}
            >
              <span
                className={`text-xl sm:text-2xl drop-shadow-[0_0_6px_rgba(0,0,0,0.8)] ${
                  b.choice === "kela" ? "kela-radar-bubble-kela" : "kela-radar-bubble-saeb"
                }`}
              >
                {b.choice === "kela" ? "🍌" : "🍎"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live vote tally below radar */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-base">🍌</span>
          <span className="font-bold text-yellow-600 tabular-nums">{votesYes}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1">
          <span className="text-base">🍎</span>
          <span className="font-bold text-red-600 tabular-nums">{votesNo}</span>
        </div>
      </div>

      {/* Status hint */}
      <div className="text-[10px] text-muted-foreground text-center min-h-[14px]">
        {closed
          ? "Voting closed"
          : hasVoted
          ? "Radar scanning... waiting for others"
          : "Cast your vote below 👇"}
      </div>
    </div>
  );
}

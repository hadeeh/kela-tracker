"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  roomCode: string;
  memberId: string;
  memberName: string;
  kelaCount?: number;
};

type Broadcast = {
  type: "sticker" | "sound";
  achievementId: string;
  memberName: string;
  stickerUrl: string | null;
  soundUrl: string | null;
  timestamp: number;
};

type RewardData = Record<string, { stickerUrl: string | null; soundUrl: string | null }>;

const EATER_BADGE_IDS = ["badge-rookie", "badge-starter", "badge-bronze", "badge-silver", "badge-gold", "badge-platinum", "badge-diamond"];
const EATER_BADGE_LABELS: Record<string, string> = {
  "badge-rookie": "🍌 Kela Eater (1+)",
  "badge-starter": "🍌 Kela Regular (5+)",
  "badge-bronze": "🥉 Bronze: Kela Boss (10+)",
  "badge-silver": "🥈 Silver: Kela Sultan (20+)",
  "badge-gold": "🥇 Gold: Kela Emperor (30+)",
  "badge-platinum": "💎 Platinum: Kela Legend (50+)",
  "badge-diamond": "👑 Diamond: Kela Godfather (100+)",
};
const EATER_BADGE_MIN = { "badge-rookie": 1, "badge-starter": 5, "badge-bronze": 10, "badge-silver": 20, "badge-gold": 30, "badge-platinum": 50, "badge-diamond": 100 };

export function SoundBar({ roomCode, memberId, memberName, kelaCount = 0 }: Props) {
  const [lastTs, setLastTs] = useState(Date.now());
  const [showSticker, setShowSticker] = useState<Broadcast | null>(null);
  const [rewards, setRewards] = useState<RewardData>({});
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load achievement rewards to show unlocked eater badge sounds
  useEffect(() => {
    async function loadRewards() {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/achievements`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setRewards(data.rewards || {});
        }
      } catch {}
    }
    loadRewards();
  }, [roomCode]);

  async function playBadgeSound(badgeId: string) {
    const reward = rewards[badgeId];
    if (!reward?.soundUrl) return;
    const audio = new Audio(`${reward.soundUrl}?t=${Date.now()}`);
    audio.play().catch(() => {});
  }

  async function broadcastBadgeSound(badgeId: string) {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, achievementId: badgeId, type: "sound" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Broadcast failed.");
        return;
      }
      if (data.broadcast?.soundUrl) {
        const audio = new Audio(`${data.broadcast.soundUrl}?t=${Date.now()}`);
        audio.play().catch(() => {});
      }
      toast.success("📢 Sound broadcast to all room members!");
    } catch (e: any) {
      toast.error(e?.message || "Broadcast failed.");
    }
  }

  // Poll for new broadcasts
  useEffect(() => {
    let cancelled = false;

    async function pollBroadcast() {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/broadcast?ts=${lastTs}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.broadcast && data.broadcast.timestamp > lastTs) {
          setLastTs(data.broadcast.timestamp);

          // If it's a sound, play it
          if (data.broadcast.soundUrl) {
            const audio = new Audio(`${data.broadcast.soundUrl}?t=${Date.now()}`);
            audio.play().catch(() => {});
            toast.message(`📢 ${data.broadcast.memberName || "Someone"} played a sound!`);
          }

          // If it's a sticker, show it
          if (data.broadcast.stickerUrl) {
            setShowSticker(data.broadcast);
            setTimeout(() => setShowSticker(null), 5000); // show for 5 seconds
            toast.message(`📢 ${data.broadcast.memberName || "Someone"} shared a sticker!`);
          }
        }
      } catch {}

      if (!cancelled) {
        pollRef.current = setTimeout(pollBroadcast, 1500);
      }
    }

    pollBroadcast();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [roomCode, lastTs]);

  return (
    <>
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            🔊 Sound Bar
          </CardTitle>
          <CardDescription className="text-xs">
            When anyone plays a sticker/sound, everyone in the room hears/sees it instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Unlocked eater badge sounds */}
          {EATER_BADGE_IDS.filter((id) => {
            const reward = rewards[id];
            const isUnlocked = kelaCount >= (EATER_BADGE_MIN as any)[id];
            return reward?.soundUrl && isUnlocked;
          }).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Your Unlocked Badge Sounds</div>
              <div className="flex flex-wrap gap-1.5">
                {EATER_BADGE_IDS.map((id) => {
                  const reward = rewards[id];
                  const isUnlocked = kelaCount >= (EATER_BADGE_MIN as any)[id];
                  if (!reward?.soundUrl || !isUnlocked) return null;
                  return (
                    <div key={id} className="flex items-center gap-1">
                      <button
                        onClick={() => playBadgeSound(id)}
                        className="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 whitespace-nowrap"
                      >
                        ▶ {EATER_BADGE_LABELS[id]}
                      </button>
                      <button
                        onClick={() => broadcastBadgeSound(id)}
                        className="text-[10px] px-1.5 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                        title="Broadcast to all"
                      >
                        📢
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Unlock achievements to get more sounds. Use 📢 to broadcast to everyone in the room.
          </p>
        </CardContent>
      </Card>

      {/* Full-screen sticker overlay (when someone broadcasts) */}
      {showSticker && showSticker.stickerUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSticker(null)}
        >
          <div className="text-center">
            <img
              src={`${showSticker.stickerUrl}?t=${showSticker.timestamp}`}
              alt="Broadcast sticker"
              className="max-w-[60vw] max-h-[60vh] rounded-2xl shadow-2xl animate-[pop_0.3s_ease]"
            />
            <div className="mt-3 text-white text-sm font-semibold">
              📢 {showSticker.memberName} shared this!
            </div>
            <div className="text-white/60 text-xs mt-1">Tap anywhere to dismiss</div>
          </div>
        </div>
      )}
    </>
  );
}

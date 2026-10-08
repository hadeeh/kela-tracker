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
};

type Broadcast = {
  type: "sticker" | "sound";
  achievementId: string;
  memberName: string;
  stickerUrl: string | null;
  soundUrl: string | null;
  timestamp: number;
};

export function SoundBar({ roomCode, memberId, memberName }: Props) {
  const [lastTs, setLastTs] = useState(Date.now());
  const [showSticker, setShowSticker] = useState<Broadcast | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            <span className="text-[10px] font-normal text-muted-foreground">(Discord-style)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            When anyone plays a sticker/sound, everyone in the room hears/sees it instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Unlock achievements in the 🏆 Achievements tab, then use 📢 buttons to broadcast to everyone.
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

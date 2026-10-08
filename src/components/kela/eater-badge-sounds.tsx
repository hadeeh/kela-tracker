"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { EATER_BADGE_REWARDS } from "@/lib/badges";

type Props = {
  roomCode: string;
  memberId: string;
  isMinister: boolean;
  kelaCount: number; // current user's kela count (to show unlocked state)
};

type RewardData = Record<string, { stickerUrl: string | null; soundUrl: string | null }>;

export function EaterBadgeSounds({ roomCode, memberId, isMinister, kelaCount }: Props) {
  const [rewards, setRewards] = useState<RewardData>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const soundRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadRewards();
  }, [roomCode]);

  async function loadRewards() {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/achievements`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRewards(data.rewards || {});
      }
    } catch {}
  }

  async function handleUpload(badgeId: string, file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    setUploading(badgeId);
    try {
      const formData = new FormData();
      formData.append("memberId", memberId);
      formData.append("achievementId", badgeId);
      formData.append("sound", file);

      const res = await fetch(`/api/rooms/${roomCode}/achievements`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Upload failed.");
        return;
      }
      toast.success("🎵 Sound uploaded!");
      loadRewards();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(badgeId: string) {
    setDeleting(badgeId);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/achievements`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, achievementId: badgeId, type: "sound" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to remove.");
        return;
      }
      toast.success("Sound removed.");
      loadRewards();
    } finally {
      setDeleting(null);
    }
  }

  function playSound(badgeId: string) {
    const reward = rewards[badgeId];
    if (!reward?.soundUrl) return;
    const audio = new Audio(`${reward.soundUrl}?t=${Date.now()}`);
    audio.play().catch(() => {});
  }

  async function broadcastSound(badgeId: string) {
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

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          🍌 Eater Badge Sounds
        </CardTitle>
        <CardDescription className="text-xs">
          {isMinister
            ? "Upload custom sounds for each eater badge. Plays when someone earns the badge!"
            : "Play your unlocked badge sounds or broadcast to everyone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EATER_BADGE_REWARDS.map((badge) => {
            const reward = rewards[badge.id] || { stickerUrl: null, soundUrl: null };
            const isUnlocked = kelaCount >= badge.minKelas;
            return (
              <div
                key={badge.id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 ${badge.color} ${!isUnlocked ? "opacity-50" : ""}`}
              >
                <div className="text-2xl flex-shrink-0">{badge.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs sm:text-sm truncate">{badge.title}</div>
                  <div className="text-[10px] opacity-80">{badge.minKelas}+ kelas</div>
                </div>

                {/* Play button (if sound exists + unlocked) */}
                {isUnlocked && reward.soundUrl && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => playSound(badge.id)}
                      className="text-[10px] px-1.5 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
                      title="Preview sound"
                    >
                      <Play className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => broadcastSound(badge.id)}
                      className="text-[10px] px-1.5 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                      title="Broadcast to all"
                    >
                      📢
                    </button>
                  </div>
                )}

                {/* Minister upload controls */}
                {isMinister && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      ref={(el) => { soundRefs.current[badge.id] = el; }}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(badge.id, f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => soundRefs.current[badge.id]?.click()}
                      disabled={uploading === badge.id}
                      className="text-[10px] px-1.5 py-1 rounded border hover:bg-white/50"
                      title="Upload sound"
                    >
                      {uploading === badge.id ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : "🎵"}
                    </button>
                    {reward.soundUrl && (
                      <button
                        onClick={() => handleDelete(badge.id)}
                        disabled={deleting === badge.id}
                        className="text-[10px] px-1.5 py-1 rounded border text-red-500 hover:bg-red-50"
                        title="Remove sound"
                      >
                        {deleting === badge.id ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : "✕"}
                      </button>
                    )}
                  </div>
                )}

                {/* Lock icon for locked badges */}
                {!isUnlocked && (
                  <div className="text-lg flex-shrink-0">🔒</div>
                )}
              </div>
            );
          })}
        </div>

        {isMinister && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 text-[10px] text-yellow-800">
            💡 Upload a sound for each badge tier. When someone eats enough kelas to earn that badge, the sound plays automatically!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

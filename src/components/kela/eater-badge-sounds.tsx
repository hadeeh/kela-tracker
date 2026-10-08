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
  kelaCount: number;
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

  // Non-ministers don't see this card at all — only minister manages sounds here.
  // Unlocked sounds appear in the SoundBar section for users to play/broadcast.
  if (!isMinister) return null;

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          🍌 Eater Badge Sounds <span className="text-[10px] font-normal text-muted-foreground">(Minister only)</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Upload custom sounds for each eater badge. When users unlock a badge, the sound appears in their Sound Bar to play/broadcast.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EATER_BADGE_REWARDS.map((badge) => {
            const reward = rewards[badge.id] || { stickerUrl: null, soundUrl: null };
            return (
              <div
                key={badge.id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 ${badge.color}`}
              >
                <div className="text-2xl flex-shrink-0">{badge.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs sm:text-sm truncate">{badge.title}</div>
                  <div className="text-[10px] opacity-80">{badge.minKelas}+ kelas</div>
                </div>

                {/* Sound status */}
                {reward.soundUrl ? (
                  <span className="text-[10px] text-green-600 font-semibold flex-shrink-0">✓ Sound</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">No sound</span>
                )}

                {/* Upload / Remove controls */}
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
                    className="text-[10px] px-2 py-1 rounded border hover:bg-white/50"
                    title="Upload sound"
                  >
                    {uploading === badge.id ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : "🎵 Upload"}
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
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 text-[10px] text-yellow-800">
          💡 Upload a sound for each badge tier. When someone earns a badge, the sound appears in their Sound Bar — they can play it locally or broadcast to the whole room!
        </div>
      </CardContent>
    </Card>
  );
}

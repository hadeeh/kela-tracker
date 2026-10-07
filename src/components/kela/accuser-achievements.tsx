"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { getAccuserAchievements, getNextAccuserAchievement, ACCUSER_ACHIEVEMENTS } from "@/lib/badges";

type Props = {
  accusationCount: number;
  roomCode: string;
  memberId: string;
  isMinister: boolean;
};

type RewardData = Record<string, { stickerUrl: string | null; soundUrl: string | null }>;

export function AccuserAchievements({ accusationCount, roomCode, memberId, isMinister }: Props) {
  const [rewards, setRewards] = useState<RewardData>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const stickerRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const soundRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const achievements = getAccuserAchievements(accusationCount);
  const nextAchievement = getNextAccuserAchievement(accusationCount);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPct = nextAchievement
    ? Math.min(100, (accusationCount / nextAchievement.minAccusations) * 100)
    : 100;

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

  async function handleUpload(achievementId: string, type: "sticker" | "sound", file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    setUploading(`${achievementId}-${type}`);
    try {
      const formData = new FormData();
      formData.append("memberId", memberId);
      formData.append("achievementId", achievementId);
      formData.append(type, file);

      const res = await fetch(`/api/rooms/${roomCode}/achievements`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Upload failed.");
        return;
      }
      toast.success(`${type === "sticker" ? "Sticker" : "Sound"} uploaded for ${achievementId}!`);
      loadRewards();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(achievementId: string, type: "sticker" | "sound") {
    setDeleting(`${achievementId}-${type}`);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/achievements`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, achievementId, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to remove.");
        return;
      }
      toast.success(`${type === "sticker" ? "Sticker" : "Sound"} removed.`);
      loadRewards();
    } finally {
      setDeleting(null);
    }
  }

  function playSound(achievementId: string) {
    const reward = rewards[achievementId];
    if (!reward?.soundUrl) return;
    const audio = new Audio(`${reward.soundUrl}?t=${Date.now()}`);
    audio.play().catch(() => {});
  }

  return (
    <Card className="border-green-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          🏆 Accuser Achievements
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
            {unlockedCount}/{achievements.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Unlock stickers as you accuse more. {accusationCount} accusations so far.
          {isMinister && " As minister, upload custom stickers/gifs/sounds for each achievement!"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        {nextAchievement && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Next: {nextAchievement.emoji} {nextAchievement.title}</span>
              <span className="font-semibold">{accusationCount}/{nextAchievement.minAccusations}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Achievement stickers grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {achievements.map((a) => {
            const reward = rewards[a.id] || { stickerUrl: null, soundUrl: null };
            return (
              <div
                key={a.id}
                className={`relative rounded-lg border p-3 text-center transition ${
                  a.unlocked ? `${a.color} opacity-100` : "bg-muted/50 border-muted opacity-40 grayscale"
                }`}
              >
                {/* Lock overlay */}
                {!a.unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="text-2xl">🔒</span>
                  </div>
                )}

                {/* Sticker: custom upload or default emoji */}
                <div className={`text-2xl mb-1 ${a.unlocked ? "" : "blur-sm"}`}>
                  {reward.stickerUrl ? (
                    <img src={`${reward.stickerUrl}?t=${Date.now()}`} alt={a.title} className="w-12 h-12 mx-auto object-contain rounded" />
                  ) : (
                    <span className="text-2xl">{a.sticker}</span>
                  )}
                </div>
                <div className={`text-xs font-bold ${a.unlocked ? "" : "text-muted-foreground"}`}>{a.title}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{a.minAccusations}+ acc</div>

                {/* Play sound button (if sound uploaded + unlocked) */}
                {a.unlocked && reward.soundUrl && (
                  <button onClick={() => playSound(a.id)} className="mt-1 text-[10px] text-blue-600 hover:text-blue-700 flex items-center justify-center gap-0.5 w-full">
                    <Play className="h-2.5 w-2.5" /> Sound
                  </button>
                )}

                {/* Minister upload controls */}
                {isMinister && (
                  <div className="mt-2 flex items-center justify-center gap-1 flex-wrap">
                    <input
                      ref={(el) => { stickerRefs.current[a.id] = el; }}
                      type="file"
                      accept="image/*,image/gif"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(a.id, "sticker", f); e.target.value = ""; }}
                    />
                    <input
                      ref={(el) => { soundRefs.current[a.id] = el; }}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(a.id, "sound", f); e.target.value = ""; }}
                    />
                    <button
                      onClick={() => stickerRefs.current[a.id]?.click()}
                      disabled={uploading === `${a.id}-sticker`}
                      className="text-[9px] px-1.5 py-0.5 rounded border hover:bg-white/50"
                      title="Upload sticker/gif"
                    >
                      {uploading === `${a.id}-sticker` ? <Loader2 className="h-2 w-2 animate-spin inline" /> : "🖼️"}
                    </button>
                    <button
                      onClick={() => soundRefs.current[a.id]?.click()}
                      disabled={uploading === `${a.id}-sound`}
                      className="text-[9px] px-1.5 py-0.5 rounded border hover:bg-white/50"
                      title="Upload sound"
                    >
                      {uploading === `${a.id}-sound` ? <Loader2 className="h-2 w-2 animate-spin inline" /> : "🎵"}
                    </button>
                    {(reward.stickerUrl || reward.soundUrl) && (
                      <>
                        {reward.stickerUrl && (
                          <button
                            onClick={() => handleDelete(a.id, "sticker")}
                            disabled={deleting === `${a.id}-sticker`}
                            className="text-[9px] px-1.5 py-0.5 rounded border text-red-500 hover:bg-red-50"
                            title="Remove sticker"
                          >
                            {deleting === `${a.id}-sticker` ? <Loader2 className="h-2 w-2 animate-spin inline" /> : "✕"}
                          </button>
                        )}
                        {reward.soundUrl && (
                          <button
                            onClick={() => handleDelete(a.id, "sound")}
                            disabled={deleting === `${a.id}-sound`}
                            className="text-[9px] px-1.5 py-0.5 rounded border text-red-500 hover:bg-red-50"
                            title="Remove sound"
                          >
                            {deleting === `${a.id}-sound` ? <Loader2 className="h-2 w-2 animate-spin inline" /> : "✕"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isMinister && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 text-[10px] text-yellow-800">
            💡 Upload custom stickers/gifs (🖼️) and sounds (🎵) for each achievement. Members only see/hear them when they unlock the achievement — like PUBG!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

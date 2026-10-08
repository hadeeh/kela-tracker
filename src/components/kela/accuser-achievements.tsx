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
  memberName: string;
};

type RewardData = Record<string, { stickerUrl: string | null; soundUrl: string | null }>;

export function AccuserAchievements({ accusationCount, roomCode, memberId, isMinister, memberName }: Props) {
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
      toast.success(`${type === "sticker" ? "Sticker" : "Sound"} uploaded!`);
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

  async function broadcastAchievement(achievementId: string, type: "sticker" | "sound") {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, achievementId, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Broadcast failed.");
        return;
      }
      // Play locally
      if (type === "sound" && data.broadcast?.soundUrl) {
        const audio = new Audio(`${data.broadcast.soundUrl}?t=${Date.now()}`);
        audio.play().catch(() => {});
      }
      toast.success(`${type === "sticker" ? "🖼️ Sticker" : "🎵 Sound"} broadcast to all room members!`);
    } catch (e: any) {
      toast.error(e?.message || "Broadcast failed.");
    }
  }

  return (
    <Card className="border-green-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          🏆 Accuser Achievements
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
            {unlockedCount}/{achievements.length}
          </Badge>
          {isMinister && (
            <span className="text-[10px] font-normal text-muted-foreground bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-300">
              ⚙️ Minister controls
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Unlock stickers as you accuse more. {accusationCount} confirmed accusations so far.
          {isMinister && " As minister, upload custom stickers/gifs/sounds for each tier below."}
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

        {/* ============ MINISTER UPLOAD PANEL (only for minister) ============ */}
        {isMinister && (
          <div className="rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50/50 p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🎤</span>
              <div>
                <div className="text-sm font-bold text-yellow-900">Minister Upload Panel</div>
                <div className="text-[10px] text-yellow-800/80">Upload a sticker (PNG/GIF) and/or sound (MP3/WAV) for each achievement tier. Max 2MB each.</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {achievements.map((a) => {
                const reward = rewards[a.id] || { stickerUrl: null, soundUrl: null };
                const hasAnything = reward.stickerUrl || reward.soundUrl;
                return (
                  <div
                    key={`upload-${a.id}`}
                    className={`rounded-lg border p-2.5 ${a.unlocked ? a.color : "bg-white border-muted"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{a.sticker}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs truncate">{a.title}</div>
                        <div className="text-[10px] opacity-70">{a.minAccusations}+ accusations</div>
                      </div>
                      {!a.unlocked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">🔒 locked</span>
                      )}
                    </div>

                    {/* Hidden file inputs */}
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

                    {/* Status + actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => stickerRefs.current[a.id]?.click()}
                        disabled={uploading === `${a.id}-sticker`}
                        className="text-[10px] px-2 py-1 rounded-md border bg-white hover:bg-yellow-50 font-semibold flex items-center gap-1 disabled:opacity-50"
                        title="Upload sticker / GIF"
                      >
                        {uploading === `${a.id}-sticker` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "🖼️"}
                        Sticker
                        {reward.stickerUrl && <span className="text-green-600 ml-0.5">✓</span>}
                      </button>
                      <button
                        onClick={() => soundRefs.current[a.id]?.click()}
                        disabled={uploading === `${a.id}-sound`}
                        className="text-[10px] px-2 py-1 rounded-md border bg-white hover:bg-yellow-50 font-semibold flex items-center gap-1 disabled:opacity-50"
                        title="Upload sound"
                      >
                        {uploading === `${a.id}-sound` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "🎵"}
                        Sound
                        {reward.soundUrl && <span className="text-green-600 ml-0.5">✓</span>}
                      </button>
                      {hasAnything && (
                        <button
                          onClick={() => {
                            if (reward.stickerUrl) handleDelete(a.id, "sticker");
                            if (reward.soundUrl) handleDelete(a.id, "sound");
                          }}
                          disabled={deleting === `${a.id}-sticker` || deleting === `${a.id}-sound`}
                          className="text-[10px] px-1.5 py-1 rounded-md border text-red-600 hover:bg-red-50 font-semibold disabled:opacity-50"
                          title="Remove all uploaded assets"
                        >
                          {deleting === `${a.id}-sticker` || deleting === `${a.id}-sound` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "✕ Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ ACHIEVEMENT STICKERS GRID (everyone) ============ */}
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {isMinister ? "Achievement Tiers Preview" : "Your Achievement Tiers"}
          </div>
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

                  {/* Broadcast buttons (if unlocked + has custom sticker/sound) */}
                  {a.unlocked && (reward.stickerUrl || reward.soundUrl) && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      {reward.stickerUrl && (
                        <button
                          onClick={() => broadcastAchievement(a.id, "sticker")}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                          title="Broadcast sticker to everyone"
                        >
                          📢 Show
                        </button>
                      )}
                      {reward.soundUrl && (
                        <button
                          onClick={() => broadcastAchievement(a.id, "sound")}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
                          title="Play sound on all devices"
                        >
                          📢 Play
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isMinister && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 text-[10px] text-yellow-800">
            💡 Uploaded stickers appear in the grid above for users who unlock that tier. They can tap <b>📢 Show</b> or <b>📢 Play</b> to broadcast to everyone in the room.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

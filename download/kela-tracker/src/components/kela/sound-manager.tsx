"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Trash2, Play, Volume2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useSounds, refreshRoomSounds, type SoundName } from "./use-sounds";

type SoundConfig = {
  type: SoundName;
  label: string;
  description: string;
  emoji: string;
};

const SOUND_CONFIGS: SoundConfig[] = [
  { type: "vote-start", label: "Vote Start", description: "Plays when someone starts a vote", emoji: "📣" },
  { type: "kela-vote",  label: "Kela Vote",  description: "Plays when someone votes 🍌 Kela", emoji: "🍌" },
  { type: "saeb-vote",  label: "Saeb Vote",  description: "Plays when someone votes 🍎 Saeb", emoji: "🍎" },
];

type Props = {
  roomCode: string;
  memberId: string;
  onSoundsChanged: () => void;
};

export function SoundManager({ roomCode, memberId, onSoundsChanged }: Props) {
  const { play } = useSounds();
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [customStatus, setCustomStatus] = useState<Record<string, boolean>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load custom sound status
  async function loadStatus() {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/sounds`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const status: Record<string, boolean> = {};
        for (const c of SOUND_CONFIGS) {
          status[c.type] = !!data.sounds[c.type];
        }
        setCustomStatus(status);
      }
    } catch {}
  }

  // Load on mount
  useState(() => { loadStatus(); });

  async function handleUpload(type: SoundName, file: File) {
    setUploading(type);
    try {
      const formData = new FormData();
      formData.append("memberId", memberId);
      formData.append("soundType", type);
      formData.append("file", file);

      const res = await fetch(`/api/rooms/${roomCode}/sounds`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Upload failed.");
        return;
      }
      toast.success(`${SOUND_CONFIGS.find((c) => c.type === type)?.label} sound updated!`);
      refreshRoomSounds(roomCode);
      await loadStatus();
      onSoundsChanged();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function handleReset(type: SoundName) {
    setDeleting(type);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/sounds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, soundType: type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Reset failed.");
        return;
      }
      toast.success(`${SOUND_CONFIGS.find((c) => c.type === type)?.label} reset to default.`);
      refreshRoomSounds(roomCode);
      await loadStatus();
      onSoundsChanged();
    } catch (e: any) {
      toast.error(e?.message || "Reset failed.");
    } finally {
      setDeleting(null);
    }
  }

  function previewSound(type: SoundName) {
    // For preview, we need to load the latest. Force reload by clearing cache.
    refreshRoomSounds(roomCode);
    setTimeout(() => play(type), 300);
  }

  return (
    <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-600" />
          Sound Manager
          <Badge className="bg-yellow-400 hover:bg-yellow-400 text-yellow-950">👑 Kela Minister</Badge>
        </CardTitle>
        <CardDescription>
          Upload custom sound effects for this room. Only you (the Kela Minister) can change these. Everyone in the room will hear your custom sounds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SOUND_CONFIGS.map((config) => (
          <div key={config.type} className="rounded-lg border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{config.emoji}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
              </div>
              {customStatus[config.type] && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 flex-shrink-0">
                  Custom
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={(el) => { fileRefs.current[config.type] = el; }}
                type="file"
                accept="audio/wav,audio/mpeg,audio/ogg,audio/mp4,audio/webm,.wav,.mp3,.ogg,.m4a,.webm"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(config.type, file);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRefs.current[config.type]?.click()}
                disabled={uploading === config.type}
              >
                {uploading === config.type ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => previewSound(config.type)}
                disabled={uploading === config.type}
              >
                <Play className="h-4 w-4 mr-1" />
                Preview
              </Button>
              {customStatus[config.type] && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReset(config.type)}
                  disabled={deleting === config.type}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deleting === config.type ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Reset
                </Button>
              )}
            </div>
          </div>
        ))}
        <div className="rounded-lg bg-yellow-100/50 border border-yellow-200 p-3 text-xs text-yellow-800">
          💡 <b>Tip:</b> Upload short audio clips (1-5 seconds) for the best experience. Max 5MB per file. Supported formats: WAV, MP3, OGG, M4A, WebM.
        </div>
      </CardContent>
    </Card>
  );
}

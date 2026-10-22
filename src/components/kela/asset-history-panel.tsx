"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RotateCcw, Image as ImageIcon, Volume2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDialog } from "./use-confirm-dialog";

type Version = {
  id: string;
  mimeType: string;
  fileName: string | null;
  uploadedBy: string | null;
  uploadedByName: string | null;
  note: string | null;
  createdAt: string;
  previewUrl: string;
};

type AssetGroup = {
  assetKey: string;
  label: string;
  previewType: "audio" | "image";
  versions: Version[];
};

type Props = {
  roomCode: string;
  memberId: string;
  isMinister: boolean;
  /** Called after any revert so other UI can refresh */
  onAssetsChanged?: () => void;
};

/**
 * AssetHistoryPanel — consolidated view of ALL sound/sticker upload history
 * in a room. Minister can preview any past version and revert to it.
 *
 * Lists every asset slot (each sound type + each achievement sticker/sound)
 * with its version timeline. Used in the dedicated "History" tab.
 *
 * Non-ministers see a read-only view (previews only, no revert buttons).
 */

// All asset slots we track history for. Each one corresponds to an assetKey
// used by the upload endpoints.
const ASSET_SLOTS: { assetKey: string; label: string; previewType: "audio" | "image"; group: string }[] = [
  // Custom vote/event sounds (CustomSound table)
  { assetKey: "sound:vote-start",  label: "Vote Start",       previewType: "audio", group: "Vote Sounds" },
  { assetKey: "sound:kela-vote",   label: "Kela Vote",        previewType: "audio", group: "Vote Sounds" },
  { assetKey: "sound:saeb-vote",   label: "Saeb Vote",        previewType: "audio", group: "Vote Sounds" },
  { assetKey: "sound:result-kela", label: "Kela Confirmed",   previewType: "audio", group: "Vote Sounds" },
  // Eater badge sounds (AchievementReward.soundData)
  { assetKey: "sound:badge-rookie",    label: "🍌 Rookie Badge",      previewType: "audio", group: "Eater Badge Sounds" },
  { assetKey: "sound:badge-starter",   label: "🍌 Starter Badge",     previewType: "audio", group: "Eater Badge Sounds" },
  { assetKey: "sound:badge-bronze",    label: "🥉 Bronze Badge",      previewType: "audio", group: "Eater Badge Sounds" },
  { assetKey: "sound:badge-silver",    label: "🥈 Silver Badge",      previewType: "audio", group: "Eater Badge Sounds" },
  { assetKey: "sound:badge-gold",      label: "🥇 Gold Badge",        previewType: "audio", group: "Eater Badge Sounds" },
  { assetKey: "sound:badge-platinum",  label: "💎 Platinum Badge",    previewType: "audio", group: "Eater Badge Sounds" },
  { assetKey: "sound:badge-diamond",   label: "👑 Diamond Badge",     previewType: "audio", group: "Eater Badge Sounds" },
  // Accuser achievement sounds (AchievementReward.soundData)
  { assetKey: "sound:first-blood",  label: "🎯 First Blood",       previewType: "audio", group: "Accuser Achievement Sounds" },
  { assetKey: "sound:watchdog",     label: "🐕 Watchdog",          previewType: "audio", group: "Accuser Achievement Sounds" },
  { assetKey: "sound:hunter",       label: "🏹 Hunter",            previewType: "audio", group: "Accuser Achievement Sounds" },
  { assetKey: "sound:instigator",   label: "⚔️ Instigator",        previewType: "audio", group: "Accuser Achievement Sounds" },
  { assetKey: "sound:prosecutor",   label: "⚖️ Prosecutor",        previewType: "audio", group: "Accuser Achievement Sounds" },
  { assetKey: "sound:sniper",       label: "🎯 Sniper",            previewType: "audio", group: "Accuser Achievement Sounds" },
  { assetKey: "sound:godfather",    label: "👑 Godfather",         previewType: "audio", group: "Accuser Achievement Sounds" },
  // Accuser achievement stickers (AchievementReward.stickerData)
  { assetKey: "sticker:first-blood",  label: "🎯 First Blood Sticker",   previewType: "image", group: "Accuser Achievement Stickers" },
  { assetKey: "sticker:watchdog",     label: "🐕 Watchdog Sticker",      previewType: "image", group: "Accuser Achievement Stickers" },
  { assetKey: "sticker:hunter",       label: "🏹 Hunter Sticker",        previewType: "image", group: "Accuser Achievement Stickers" },
  { assetKey: "sticker:instigator",   label: "⚔️ Instigator Sticker",    previewType: "image", group: "Accuser Achievement Stickers" },
  { assetKey: "sticker:prosecutor",   label: "⚖️ Prosecutor Sticker",    previewType: "image", group: "Accuser Achievement Stickers" },
  { assetKey: "sticker:sniper",       label: "🎯 Sniper Sticker",        previewType: "image", group: "Accuser Achievement Stickers" },
  { assetKey: "sticker:godfather",    label: "👑 Godfather Sticker",     previewType: "image", group: "Accuser Achievement Stickers" },
];

export function AssetHistoryPanel({ roomCode, memberId, isMinister, onAssetsChanged }: Props) {
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  useEffect(() => {
    loadAll();
  }, [roomCode]);

  async function loadAll() {
    setLoading(true);
    try {
      // Fetch history for all asset slots in parallel
      const results = await Promise.all(
        ASSET_SLOTS.map(async (slot) => {
          try {
            const res = await fetch(
              `/api/rooms/${roomCode}/assets/${encodeURIComponent(slot.assetKey)}/history?memberId=${encodeURIComponent(memberId)}`,
              { cache: "no-store" }
            );
            if (!res.ok) return null;
            const data = await res.json();
            return {
              assetKey: slot.assetKey,
              label: slot.label,
              previewType: slot.previewType,
              versions: data.versions || [],
            } as AssetGroup;
          } catch {
            return null;
          }
        })
      );
      setGroups(results.filter((g): g is AssetGroup => g !== null && g.versions.length > 0));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevert(assetKey: string, label: string, version: Version) {
    const ok = await confirm({
      title: `Revert ${label}?`,
      description: `This restores the version from ${new Date(version.createdAt).toLocaleString()}. The current version will be auto-saved to history first, so you can still come back to it later.`,
      confirmLabel: "Revert to this version",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    setReverting(version.id);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/assets/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, assetKey, versionId: version.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to revert.");
        return;
      }
      toast.success(`Reverted ${label} to version from ${new Date(version.createdAt).toLocaleString()}.`);
      onAssetsChanged?.();
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to revert.");
    } finally {
      setReverting(null);
    }
  }

  function previewVersion(v: Version, previewType: "audio" | "image") {
    const url = `${v.previewUrl}?memberId=${encodeURIComponent(memberId)}&t=${Date.now()}`;
    if (previewType === "audio") {
      const audio = new Audio(url);
      audio.play().catch(() => toast.error("Couldn't play preview."));
    } else {
      window.open(url, "_blank");
    }
  }

  // Group slots by their `group` field for display
  const groupedBySection = groups.reduce((acc, g) => {
    const slot = ASSET_SLOTS.find((s) => s.assetKey === g.assetKey);
    const section = slot?.group || "Other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(g);
    return acc;
  }, {} as Record<string, AssetGroup[]>);

  if (!isMinister) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <p className="font-semibold">Minister only</p>
          <p className="text-xs text-muted-foreground mt-1">
            Only the Kela Minister can view and revert sound/sticker upload history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            📜 Upload History & Revert
          </CardTitle>
          <CardDescription>
            Every previous upload of sounds and stickers is saved here automatically. Preview any past version and revert to it — the current version is auto-saved first, so reverting is never destructive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="text-4xl mb-2">🗂️</div>
              <p className="font-medium">No history yet.</p>
              <p className="text-xs mt-1">Upload a sound or sticker once, then upload it again — the first version will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedBySection).map(([section, items]) => (
                <div key={section}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 pb-1 border-b">
                    {section}
                  </div>
                  <div className="space-y-3">
                    {items.map((g) => (
                      <div key={g.assetKey} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="font-semibold text-sm">{g.label}</div>
                          <Badge variant="secondary" className="text-[10px]">
                            {g.versions.length} version{g.versions.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {g.versions.map((v, idx) => {
                            const isLatest = idx === 0;
                            return (
                              <div
                                key={v.id}
                                className={`rounded-md border p-2 flex items-center gap-2 ${isLatest ? "border-blue-300 bg-blue-50/50" : "border-border bg-white"}`}
                              >
                                <div className="flex-shrink-0">
                                  {g.previewType === "audio" ? (
                                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold flex items-center gap-1.5">
                                    {isLatest && <span className="text-[9px] uppercase bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">Latest</span>}
                                    <span>{new Date(v.createdAt).toLocaleString()}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {v.uploadedByName ? `by ${v.uploadedByName}` : "unknown"}
                                    {v.fileName ? ` · ${v.fileName}` : ""}
                                    {v.note ? ` · ${v.note}` : ""}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs flex-shrink-0"
                                  onClick={() => previewVersion(v, g.previewType)}
                                  title={g.previewType === "audio" ? "Play preview" : "View image"}
                                >
                                  {g.previewType === "audio" ? <Play className="h-3 w-3" /> : "👁"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs flex-shrink-0"
                                  disabled={reverting === v.id}
                                  onClick={() => handleRevert(g.assetKey, g.label, v)}
                                  title="Set this as the active version"
                                >
                                  {reverting === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                  <span className="ml-1 hidden sm:inline">Set as active</span>
                                  <span className="ml-1 sm:hidden">Set</span>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {confirmDialog}
    </>
  );
}

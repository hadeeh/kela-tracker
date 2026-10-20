"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, History, Play, RotateCcw } from "lucide-react";
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

type Props = {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  memberId: string;
  /** e.g., "sound:vote-start", "sticker:first-blood", "sound:badge-rookie" */
  assetKey: string;
  /** Human-friendly label shown in the dialog header, e.g., "Vote Start sound" */
  assetLabel: string;
  /** "audio" or "image" — controls how the preview is rendered */
  previewType: "audio" | "image";
  onReverted?: () => void;
};

/**
 * AssetHistoryDialog — shows the version history of a sound/sticker and lets
 * the minister revert to any previous version. Used by SoundManager,
 * EaterBadgeSounds, and AccuserAchievements.
 */
export function AssetHistoryDialog({
  open, onClose, roomCode, memberId, assetKey, assetLabel, previewType, onReverted,
}: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (!open) return;
    loadHistory();
  }, [open, assetKey, roomCode]);

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rooms/${roomCode}/assets/${encodeURIComponent(assetKey)}/history?memberId=${encodeURIComponent(memberId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to load history.");
        setVersions([]);
        return;
      }
      setVersions(data.versions || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevert(version: Version) {
    const ok = await confirm({
      title: `Revert ${assetLabel}?`,
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
      toast.success(`Reverted ${assetLabel} to version from ${new Date(version.createdAt).toLocaleString()}.`);
      onReverted?.();
      // Reload history since the revert added a new "auto-saved before revert" entry
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message || "Failed to revert.");
    } finally {
      setReverting(null);
    }
  }

  function previewVersion(v: Version) {
    if (previewType === "audio") {
      // Append memberId for auth + cache-bust
      const url = `${v.previewUrl}?memberId=${encodeURIComponent(memberId)}&t=${Date.now()}`;
      const audio = new Audio(url);
      audio.play().catch(() => toast.error("Couldn't play preview."));
    } else {
      // Open image in new tab (simpler than embedding a modal-in-modal)
      const url = `${v.previewUrl}?memberId=${encodeURIComponent(memberId)}&t=${Date.now()}`;
      window.open(url, "_blank");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              History: {assetLabel}
            </DialogTitle>
            <DialogDescription>
              Every previous upload is saved here. Click <b>Revert</b> to restore a version — the current one will be auto-saved to history first.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="text-3xl mb-2">🗂️</div>
              <p className="text-sm font-medium">No history yet.</p>
              <p className="text-xs mt-1">Previous uploads will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v, idx) => {
                const isLatest = idx === 0;
                return (
                  <div
                    key={v.id}
                    className={`rounded-lg border p-2.5 flex items-center gap-2 ${isLatest ? "border-blue-300 bg-blue-50/50" : "border-border bg-card"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        {isLatest && <span className="text-[9px] uppercase bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">Latest</span>}
                        <span>{new Date(v.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {v.uploadedByName ? `by ${v.uploadedByName}` : "unknown uploader"}
                        {v.fileName ? ` · ${v.fileName}` : ""}
                        {v.note ? ` · ${v.note}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => previewVersion(v)}
                      title={previewType === "audio" ? "Play preview" : "View image"}
                    >
                      {previewType === "audio" ? <Play className="h-3 w-3" /> : "👁"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={reverting === v.id}
                      onClick={() => handleRevert(v)}
                    >
                      {reverting === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      <span className="ml-1">Revert</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}

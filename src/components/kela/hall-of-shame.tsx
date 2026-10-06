"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";

type Mugshot = {
  id: string;
  uploaderId: string;
  targetMemberId: string | null;
  targetMemberName: string;
  caption: string | null;
  createdAt: string;
  url: string;
};

type Member = { id: string; name: string };

type Props = {
  roomCode: string;
  memberId: string;
  members: Member[];
};

export function HallOfShame({ roomCode, memberId, members }: Props) {
  const [mugshots, setMugshots] = useState<Mugshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [galleryMember, setGalleryMember] = useState<Member | null>(null);
  const [galleryMugshots, setGalleryMugshots] = useState<Mugshot[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMugshots();
  }, [roomCode]);

  async function loadMugshots() {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/mugshots`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMugshots(data.mugshots || []);
      }
    } catch {}
    setLoading(false);
  }

  async function openGallery(member: Member) {
    setGalleryMember(member);
    setGalleryLoading(true);
    setGalleryMugshots([]);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/mugshots?memberId=${member.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setGalleryMugshots(data.mugshots || []);
      }
    } catch {}
    setGalleryLoading(false);
  }

  async function handleUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (!selectedMember) {
      toast.error("Select whose kela mugshot this is!");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("uploaderId", memberId);
      formData.append("targetMemberId", selectedMember);
      formData.append("caption", caption);
      formData.append("file", file);

      const res = await fetch(`/api/rooms/${roomCode}/mugshots`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Upload failed.");
        return;
      }
      const targetName = members.find((m) => m.id === selectedMember)?.name || "Unknown";
      toast.success(`📸 Mugshot added to ${targetName}'s memory!`);
      setCaption("");
      setSelectedMember("");
      loadMugshots();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Group mugshots by member for the "memories" section
  const mugshotsByMember = mugshots.reduce((acc, m) => {
    const key = m.targetMemberId || "unknown";
    if (!acc[key]) acc[key] = { name: m.targetMemberName, count: 0, latest: m };
    acc[key].count++;
    if (new Date(m.createdAt) > new Date(acc[key].latest.createdAt)) {
      acc[key].latest = m;
    }
    return acc;
  }, {} as Record<string, { name: string; count: number; latest: Mugshot }>);

  return (
    <>
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            📸 Hall of Shame & Memories
            <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">{mugshots.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Upload funny photos when someone eats kela. Stored forever as memories — click a member to view their gallery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload section */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Whose kela mugshot? *</Label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Select member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Caption (optional)</Label>
                <Input
                  placeholder="e.g. Bilal's 5th kela today!"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={200}
                  className="h-9"
                />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !selectedMember}
              className="w-full h-9"
              size="sm"
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
              Upload Mugshot
            </Button>
          </div>

          {/* Member memory galleries */}
          {Object.keys(mugshotsByMember).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">📸 Member Memories</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(mugshotsByMember).map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => openGallery({ id: key, name: data.name })}
                    className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted transition text-left"
                  >
                    <div className="relative flex-shrink-0">
                      {/* Show latest mugshot thumbnail */}
                      <img
                        src={data.latest.url}
                        alt={data.name}
                        className="h-10 w-10 rounded-full object-cover border-2 border-yellow-300"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {data.count}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{data.name}</div>
                      <div className="text-[10px] text-muted-foreground">{data.count} photo{data.count === 1 ? "" : "s"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent mugshots grid */}
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mugshots.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-3xl mb-1">🕊️</div>
              <p className="text-sm font-medium">No mugshots yet.</p>
              <p className="text-xs mt-1">Upload a funny photo when someone eats kela!</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
              {mugshots.slice(0, 8).map((m) => (
                <div key={m.id} className="rounded-lg border overflow-hidden bg-card">
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={m.url}
                      alt={m.caption || m.targetMemberName}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                      {m.targetMemberName}
                    </div>
                  </div>
                  {m.caption && (
                    <div className="p-1.5 text-[10px] text-center font-medium truncate">{m.caption}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {mugshots.length > 8 && (
            <div className="text-center">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => openGallery({ id: "", name: "All" })}>
                View all {mugshots.length} mugshots →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gallery Dialog — per-user mugshots */}
      <Dialog open={!!galleryMember} onOpenChange={(o) => { if (!o) setGalleryMember(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📸 {galleryMember?.name}'s Memories
              {galleryMugshots.length > 0 && (
                <Badge variant="secondary" className="text-xs">{galleryMugshots.length} photos</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              All mugshots of {galleryMember?.name} — stored forever as kela memories.
            </DialogDescription>
          </DialogHeader>
          {galleryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : galleryMugshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-3xl mb-1">📷</div>
              <p className="text-sm">No memories yet for {galleryMember?.name}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galleryMugshots.map((m) => (
                <div key={m.id} className="rounded-lg border overflow-hidden bg-card">
                  <div className="aspect-square bg-muted">
                    <img src={m.url} alt={m.caption || ""} className="w-full h-full object-cover" />
                  </div>
                  {m.caption && (
                    <div className="p-1.5 text-[10px] text-center font-medium truncate">{m.caption}</div>
                  )}
                  <div className="px-1.5 pb-1.5 text-[9px] text-muted-foreground text-center">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

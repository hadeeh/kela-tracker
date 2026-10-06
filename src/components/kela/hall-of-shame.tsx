"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Camera } from "lucide-react";
import { toast } from "sonner";

type Mugshot = {
  id: string;
  uploaderId: string;
  caption: string | null;
  createdAt: string;
  url: string;
  accusedName: string;
};

type Props = {
  roomCode: string;
  memberId: string;
};

export function HallOfShame({ roomCode, memberId }: Props) {
  const [mugshots, setMugshots] = useState<Mugshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
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

  async function handleUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("uploaderId", memberId);
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
      toast.success("📸 Mugshot uploaded to the Hall of Shame!");
      setCaption("");
      loadMugshots();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📸 Hall of Shame
          <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">{mugshots.length}</Badge>
        </CardTitle>
        <CardDescription>
          Mugshots of kela eaters, stored forever as memories. Upload a funny photo when someone eats kela!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload section */}
        <div className="flex items-center gap-2 flex-wrap">
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
          <Input
            placeholder="Funny caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            className="flex-1 min-w-[150px]"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
            Upload Mugshot
          </Button>
        </div>

        {/* Mugshots grid */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : mugshots.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-3xl mb-1">🕊️</div>
            <p className="text-sm font-medium">No mugshots yet.</p>
            <p className="text-xs mt-1">Upload a funny photo when someone eats kela!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {mugshots.map((m) => (
              <div key={m.id} className="rounded-lg border overflow-hidden bg-card">
                <div className="aspect-square bg-muted relative">
                  
                  <img
                    src={m.url}
                    alt={m.caption || m.accusedName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {m.accusedName}
                  </div>
                </div>
                {m.caption && (
                  <div className="p-2 text-xs text-center font-medium truncate">{m.caption}</div>
                )}
                <div className="px-2 pb-2 text-[10px] text-muted-foreground text-center">
                  {new Date(m.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

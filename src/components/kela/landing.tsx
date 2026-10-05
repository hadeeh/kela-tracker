"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function Landing() {
  const router = useRouter();

  // ---- Create room state ----
  const [roomName, setRoomName] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // ---- Join room state ----
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joining, setJoining] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName || !hostEmail) {
      toast.error("Your name and email are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, hostName, hostEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to create room.");
        setCreating(false);
        return;
      }
      // Save member identity to localStorage so the room page knows who I am.
      localStorage.setItem(
        `kela:${data.room.code}`,
        JSON.stringify({ memberId: data.member.id, memberName: data.member.name, memberEmail: data.member.email })
      );
      router.push(`/room/${data.room.code}`);
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || !joinName || !joinEmail) {
      toast.error("All fields are required.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName, email: joinEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to join room.");
        setJoining(false);
        return;
      }
      localStorage.setItem(
        `kela:${data.room.code}`,
        JSON.stringify({ memberId: data.member.id, memberName: data.member.name, memberEmail: data.member.email })
      );
      router.push(`/room/${data.room.code}`);
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2 inline-block animate-bounce">🍌</div>
          <h1 className="text-3xl font-bold tracking-tight text-yellow-950">Kela Tracker</h1>
          <p className="text-sm text-yellow-800 mt-1">
            Catch your friends eating kela. Real-time Among Us-style voting with fines.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Create a new room or join an existing one with a code.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create Room</TabsTrigger>
                <TabsTrigger value="join">Join Room</TabsTrigger>
              </TabsList>

              <TabsContent value="create">
                <form onSubmit={handleCreate} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomName">Room Name (optional)</Label>
                    <Input
                      id="roomName"
                      placeholder="e.g. College Dost, Office Kela Circle"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hostName">Your Name</Label>
                    <Input
                      id="hostName"
                      placeholder="e.g. Ali"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hostEmail">Your Email</Label>
                    <Input
                      id="hostEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={hostEmail}
                      onChange={(e) => setHostEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Room 🍌"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form onSubmit={handleJoin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="joinCode">Room Code</Label>
                    <Input
                      id="joinCode"
                      placeholder="e.g. KELA-7H3K2"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="uppercase"
                      maxLength={12}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinName">Your Name</Label>
                    <Input
                      id="joinName"
                      placeholder="e.g. Bilal"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinEmail">Your Email</Label>
                    <Input
                      id="joinEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={joinEmail}
                      onChange={(e) => setJoinEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950" disabled={joining}>
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Room"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-yellow-800/80 mt-4">
          No signup needed — just enter your name and email to create or join a room.
        </p>
      </div>
    </div>
  );
}

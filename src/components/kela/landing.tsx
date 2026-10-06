"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Vote, Trophy, Music } from "lucide-react";
import { toast } from "sonner";

export function Landing() {
  const router = useRouter();

  const [roomName, setRoomName] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [creating, setCreating] = useState(false);

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

  const features = [
    { icon: Vote, title: "Real-time Voting", desc: "Among Us-style vote popups" },
    { icon: Trophy, title: "Badge System", desc: "Earn funny titles & ranks" },
    { icon: Music, title: "Custom Sounds", desc: "Upload your own audio" },
    { icon: Users, title: "Per-person Fines", desc: "Different rates for everyone" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200">
      {/* Hero + Form */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Hero */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-6xl sm:text-7xl mb-3 inline-block animate-bounce drop-shadow-lg">🍌</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-yellow-950">
              Kela Tracker
            </h1>
            <p className="text-sm sm:text-base text-yellow-800 mt-2 max-w-sm mx-auto">
              Catch your friends eating kela. Real-time Among Us-style voting with fines, badges & custom sounds.
            </p>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white/60 backdrop-blur border border-yellow-200 px-3 py-2">
                <f.icon className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-yellow-900 truncate">{f.title}</div>
                  <div className="text-[10px] text-yellow-700 truncate">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Card with tabs */}
          <Card className="shadow-xl border-yellow-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Get Started</CardTitle>
              <CardDescription>Create a room or join with a code</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="create">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="create">Create Room</TabsTrigger>
                  <TabsTrigger value="join">Join Room</TabsTrigger>
                </TabsList>

                <TabsContent value="create">
                  <form onSubmit={handleCreate} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="roomName" className="text-xs">Room Name (optional)</Label>
                      <Input
                        id="roomName"
                        placeholder="e.g. College Dost"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        maxLength={60}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hostName" className="text-xs">Your Name</Label>
                      <Input
                        id="hostName"
                        placeholder="e.g. Ali"
                        value={hostName}
                        onChange={(e) => setHostName(e.target.value)}
                        maxLength={40}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hostEmail" className="text-xs">Your Email</Label>
                      <Input
                        id="hostEmail"
                        type="email"
                        placeholder="you@example.com"
                        value={hostEmail}
                        onChange={(e) => setHostEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <Button type="submit" className="w-full h-11 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold" disabled={creating}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Room 🍌"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="join">
                  <form onSubmit={handleJoin} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="joinCode" className="text-xs">Room Code</Label>
                      <Input
                        id="joinCode"
                        placeholder="KELA-XXXXX"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="uppercase h-11 font-mono text-lg tracking-wider"
                        maxLength={12}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="joinName" className="text-xs">Your Name</Label>
                      <Input
                        id="joinName"
                        placeholder="e.g. Bilal"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        maxLength={40}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="joinEmail" className="text-xs">Your Email</Label>
                      <Input
                        id="joinEmail"
                        type="email"
                        placeholder="you@example.com"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <Button type="submit" className="w-full h-11 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold" disabled={joining}>
                      {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Room"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-yellow-800/70 mt-4">
            No signup needed — just enter your name and email.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-yellow-800/60 py-4">
        Made with 🍌 for easily-offended friends
      </footer>
    </div>
  );
}

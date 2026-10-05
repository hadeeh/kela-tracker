/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RoomView } from "./room-view";

type Room = { id: string; code: string; name: string; hostEmail: string; createdAt: string };
type Identity = { memberId: string; memberName: string; memberEmail: string };

// State: "loading" | "joining" | "in-room"
type State =
  | { status: "loading" }
  | { status: "joining" }
  | { status: "in-room"; me: Identity };

export function RoomClientShell({ room }: { room: Room }) {
  // Start in "loading" state (matches server). After mount, read localStorage
  // and transition to "joining" or "in-room". This avoids hydration mismatch.
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`kela:${room.code}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.memberId && parsed?.memberName) {
          setState({ status: "in-room", me: parsed });
          return;
        }
      }
    } catch {}
    setState({ status: "joining" });
  }, [room.code]);

  // Join form state
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joining, setJoining] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName || !joinEmail) {
      toast.error("Name and email are required.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/join`, {
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
      const identity: Identity = { memberId: data.member.id, memberName: data.member.name, memberEmail: data.member.email };
      localStorage.setItem(`kela:${room.code}`, JSON.stringify(identity));
      setState({ status: "in-room", me: identity });
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
      setJoining(false);
    }
  }

  // Loading state — prevents hydration mismatch
  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  // In-room state — show the dashboard
  if (state.status === "in-room") {
    return <RoomView room={room} me={state.me} />;
  }

  // Joining state — show the join form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2 inline-block">🍌</div>
          <h1 className="text-3xl font-bold tracking-tight text-yellow-950">Join &ldquo;{room.name}&rdquo;</h1>
          <p className="text-sm text-yellow-800 mt-1">Enter your name and email to join this kela circle.</p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>Room code: <span className="font-mono font-semibold">{room.code}</span></CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
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
          </CardContent>
        </Card>
        <div className="text-center mt-4">
          <Link href="/" className="text-xs text-yellow-800 hover:underline">← Create a new room instead</Link>
        </div>
      </div>
    </div>
  );
}

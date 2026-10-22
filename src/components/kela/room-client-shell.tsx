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

// State: "loading" | "joining" | "pending" | "in-room"
type State =
  | { status: "loading" }
  | { status: "joining" }
  | { status: "pending"; me: Identity }
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
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  // Step 1: Request verification code
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName || !joinEmail) {
      toast.error("Name and email are required.");
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/join/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName, email: joinEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to send code.");
        setSendingCode(false);
        return;
      }
      setCodeSent(true);
      toast.success("📧 Verification code sent! Check your email.");
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setSendingCode(false);
    }
  }

  // Step 2: Verify code and join
  async function handleVerifyAndJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName || !joinEmail || !joinCode) {
      toast.error("Please enter the verification code.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/join/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName, email: joinEmail, code: joinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to verify.");
        setJoining(false);
        return;
      }
      const identity: Identity = { memberId: data.member.id, memberName: data.member.name, memberEmail: data.member.email };
      localStorage.setItem(`kela:${room.code}`, JSON.stringify(identity));

      if (data.pendingApproval) {
        setState({ status: "pending", me: identity });
      } else {
        setState({ status: "in-room", me: identity });
      }
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

  // Pending state — waiting for minister approval
  if (state.status === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200 p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-4 inline-block animate-bounce">⏳</div>
          <h1 className="text-2xl font-bold tracking-tight text-yellow-950 mb-2">
            Waiting for Approval
          </h1>
          <p className="text-sm text-yellow-800 mb-6">
            Hi {state.me.memberName}! The Kela Minister needs to approve your join request before you can enter the room.
          </p>
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 mb-4">
            <p className="text-xs text-yellow-700">
              Room: <span className="font-semibold">{room.name}</span><br />
              Code: <span className="font-mono font-semibold">{room.code}</span><br />
              Your name: <span className="font-semibold">{state.me.memberName}</span><br />
              Your email: <span className="font-semibold">{state.me.memberEmail}</span>
            </p>
          </div>
          <p className="text-xs text-yellow-700">
            Keep this page open — it will automatically load once you&apos;re approved.
            Or check back in a minute.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-yellow-800 hover:underline"
          >
            🔄 Refresh to check status
          </button>
        </div>
      </div>
    );
  }

  // In-room state — show the dashboard
  if (state.status === "in-room") {
    return <RoomView room={room} me={state.me} />;
  }

  // Joining state — show the join form (2-step: email → OTP → verify)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2 inline-block">🍌</div>
          <h1 className="text-3xl font-bold tracking-tight text-yellow-950">Join &ldquo;{room.name}&rdquo;</h1>
          <p className="text-sm text-yellow-800 mt-1">
            {codeSent
              ? "Enter the 6-digit code we sent to your email."
              : "Enter your name and email. We'll send you a verification code."}
          </p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>Room code: <span className="font-mono font-semibold">{room.code}</span></CardDescription>
          </CardHeader>
          <CardContent>
            {!codeSent ? (
              // Step 1: Enter name + email, request code
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinName">Your Name</Label>
                  <Input
                    id="joinName"
                    placeholder="e.g. Huzaifa"
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
                  <p className="text-[10px] text-muted-foreground">
                    🔒 We&apos;ll send a 6-digit verification code to this email to verify it&apos;s really you.
                  </p>
                </div>
                <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950" disabled={sendingCode}>
                  {sendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "📧 Send Verification Code"}
                </Button>
              </form>
            ) : (
              // Step 2: Enter verification code
              <form onSubmit={handleVerifyAndJoin} className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                  <div className="text-xs text-blue-700 font-medium">Verification code sent to</div>
                  <div className="text-sm font-bold text-blue-900">{joinEmail}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joinCode">6-Digit Code</Label>
                  <Input
                    id="joinCode"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    placeholder="123456"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="text-center text-2xl font-bold tracking-[0.5em]"
                    required
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Check your email (and spam folder). Code expires in 10 minutes.
                  </p>
                </div>
                <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950" disabled={joining || joinCode.length !== 6}>
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "✓ Verify & Join"}
                </Button>
                <button
                  type="button"
                  onClick={() => { setCodeSent(false); setJoinCode(""); }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Use a different email
                </button>
              </form>
            )}
          </CardContent>
        </Card>
        <div className="text-center mt-4">
          <Link href="/" className="text-xs text-yellow-800 hover:underline">← Create a new room instead</Link>
        </div>
      </div>
    </div>
  );
}

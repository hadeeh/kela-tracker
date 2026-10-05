"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, LogOut, Copy, Mail, Check, Users, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  usePolling, type ActiveVote, type EndedVote,
} from "./use-polling";
import { useSounds, useRoomSounds } from "./use-sounds";
import { VoteModal } from "./vote-modal";
import { AccusedModal, ResultModal } from "./modals";
import { SoundManager } from "./sound-manager";
import { getBadge, getNextBadge, BADGE_TIERS } from "@/lib/badges";

type Room = { id: string; code: string; name: string; hostEmail: string; createdAt: string };
type Member = { id: string; name: string; email: string; ratePerKela: number; role: string | null; joinedAt: string };
type Incident = {
  id: string;
  userId: string;
  reason: string | null;
  accusedById: string;
  votesYes: number;
  votesNo: number;
  verdict: string;
  rateAtTime: number;
  paidAmount: number;
  settledAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; ratePerKela: number };
  accusedBy: { id: string; name: string };
  votes: { id: string; choice: string; voter: { id: string; name: string } }[];
};

type Me = { memberId: string; memberName: string; memberEmail: string };

type Props = {
  room: Room;
  me: Me;
};

export function RoomView({ room, me }: Props) {
  const router = useRouter();
  const { play } = useSounds();
  const soundsLoaded = useRoomSounds(room.code);

  // ---- Data state -------------------------------------------------------
  const [members, setMembers] = useState<Member[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ---- Settings state ---------------------------------------------------
  const [rateInput, setRateInput] = useState("50");
  const [savingRate, setSavingRate] = useState(false);
  const [myRate, setMyRate] = useState(50);

  // ---- Invite dialog ----------------------------------------------------
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"minister" | "member">("member");
  const [inviteRate, setInviteRate] = useState("50");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ---- Accuse dialog ----------------------------------------------------
  const [accuseTarget, setAccuseTarget] = useState<Member | null>(null);
  const [accuseReason, setAccuseReason] = useState("");
  const [startingVote, setStartingVote] = useState(false);

  // ---- Inline rate editing (minister only) ------------------------------
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState("50");
  const [savingRateForMember, setSavingRateForMember] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  // ---- Active vote modal (I'm a voter) ---------------------------------
  const [voteOpen, setVoteOpen] = useState(false);
  const [votedChoice, setVotedChoice] = useState<"kela" | "saeb" | null>(null);

  // ---- Accused modal (I'm the accused) ---------------------------------
  const [accusedOpen, setAccusedOpen] = useState(false);

  // ---- Result modal -----------------------------------------------------
  const [resultOpen, setResultOpen] = useState(false);

  // ---- Polling handlers (with sounds) ---------------------------------
  const onVoteStarted = useCallback((av: ActiveVote) => {
    setVotedChoice(av.myVote);
    setVoteOpen(true);
    setAccusedOpen(false);
    play("vote-start"); // 📣 Kelaaaa!
    toast.message(`🍌 Vote started against ${av.accusedName}!`);
  }, [play]);

  const onAccused = useCallback((_av: ActiveVote) => {
    setAccusedOpen(true);
    setVoteOpen(false);
    play("vote-start"); // 📣 Kelaaaa!
  }, [play]);

  const onVoteUpdate = useCallback((_yes: number, _no: number, lastChoice: "kela" | "saeb") => {
    if (lastChoice === "kela") play("kela-vote");
    else play("saeb-vote");
  }, [play]);

  const onVoteEnded = useCallback((ev: EndedVote) => {
    setVoteOpen(false);
    setAccusedOpen(false);
    setVotedChoice(null);
    setResultOpen(true);

    // Play verdict sound
    if (ev.verdict === "kela") play("result-kela");
    else if (ev.verdict === "saeb") play("result-saeb");
    else play("result-tie");

    // Check for badge level-up (only on "kela" verdict)
    if (ev.verdict === "kela") {
      // The accused's guilty count after this vote = previous + 1
      const prevGuilty = incidents.filter(
        (i) => i.user.id === ev.accusedId && i.verdict === "kela"
      ).length;
      const newGuilty = prevGuilty + 1;

      // Check if the new count matches a badge threshold
      const badge = getBadge(newGuilty);
      if (badge && newGuilty === badge.minKelas) {
        // They just earned this badge! Play the badge sound after a short delay
        setTimeout(() => {
          play(badge.soundName as any);
          toast.success(`🏅 ${ev.accusedName} just earned: ${badge.emoji} ${badge.title}!`);
        }, 1500);
      }
    }

    setTimeout(() => { refreshData(); }, 400);

    if (ev.verdict === "kela") {
      toast.success(`🍌 ${ev.accusedName} confirmed kela! Fine added.`);
    } else if (ev.verdict === "saeb") {
      toast.info(`🍎 ${ev.accusedName} is innocent. Saeb!`);
    } else {
      toast.message(`🤷 It's a tie for ${ev.accusedName}.`);
    }
  }, [play, incidents]);

  const {
    activeVote, endedVote, startVote, castVote, dismissEndedVote,
  } = usePolling(room.code, me.memberId, {
    onVoteStarted,
    onAccused,
    onVoteUpdate,
    onVoteEnded,
  });

  // Sync modal state with polling state
  useEffect(() => {
    if (activeVote) {
      if (activeVote.isAccused) {
        if (!accusedOpen) setAccusedOpen(true);
      } else {
        if (!voteOpen) setVoteOpen(true);
      }
      setVotedChoice(activeVote.myVote);
    } else {
      if (voteOpen) setVoteOpen(false);
      if (accusedOpen) setAccusedOpen(false);
    }
  }, [activeVote]);

  useEffect(() => {
    if (endedVote) {
      setResultOpen(true);
    }
  }, [endedVote]);

  // ---- Data fetching ----------------------------------------------------
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.code}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setIncidents(data.incidents || []);
        const meMember = (data.members as Member[])?.find((m) => m.id === me.memberId);
        if (meMember) {
          setMyRate(meMember.ratePerKela);
          setRateInput(String(meMember.ratePerKela));
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [room.code, me.memberId]);

  useEffect(() => {
    refreshData();
    const id = setInterval(refreshData, 15_000);
    return () => clearInterval(id);
  }, [refreshData]);

  // Set share URL on client (avoids hydration mismatch with window.location)
  useEffect(() => {
    setShareUrl(`${window.location.origin}/room/${room.code}`);
  }, [room.code]);

  // ---- Actions ----------------------------------------------------------
  function copyInviteLink() {
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Could not copy."));
  }

  async function handleInvite() {
    if (!inviteEmail) {
      toast.error("Enter your friend's email.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || undefined,
          role: inviteRole === "minister" ? "minister" : undefined,
          ratePerKela: Number(inviteRate) || 50,
          inviterId: me.memberId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to invite.");
        setInviting(false);
        return;
      }
      if (data.already) {
        toast.message(`📧 ${inviteEmail} is already in this room as "${data.member.name}".`);
      } else {
        const roleLabel = inviteRole === "minister" ? " as Kela Minister 👑" : "";
        const rateLabel = ` at PKR ${inviteRate}/kela`;
        toast.success(`✓ Added ${data.member.name}${roleLabel}${rateLabel}!`);
        if (data.emailSent) {
          toast.success(`📧 Invitation email sent to ${inviteEmail}!`);
        } else if (data.emailError) {
          toast.message(`📧 Email not sent: ${data.emailError}. Share link manually.`);
        }
        toast.message(`📧 Share this link: ${window.location.origin}/room/${room.code}`);
      }
      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
      setInviteRate("50");
      setInviteOpen(false);
      refreshData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleStartVote() {
    if (!accuseTarget) return;
    setStartingVote(true);
    const result = await startVote({
      accusedId: accuseTarget.id,
      accusedName: accuseTarget.name,
      reason: accuseReason.trim() || null,
    });
    setStartingVote(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`🍌 Vote started against ${accuseTarget.name}!`);
    setAccuseTarget(null);
    setAccuseReason("");
  }

  async function handleCastVote(choice: "kela" | "saeb") {
    if (!activeVote) return;
    const r = await castVote(activeVote.incidentId, choice);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setVotedChoice(choice);
    // Play sound for MY vote
    if (choice === "kela") play("kela-vote");
    else play("saeb-vote");
    toast.success(`Voted ${choice === "kela" ? "🍌 Kela" : "🍎 Saeb"}`);
  }

  async function saveRate() {
    const r = Number(rateInput);
    if (Number.isNaN(r) || r < 0) {
      toast.error("Enter a valid rate.");
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: me.memberId, ratePerKela: r }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to save.");
      } else {
        toast.success("Rate updated.");
        setMyRate(r);
        refreshData();
      }
    } finally {
      setSavingRate(false);
    }
  }

  // Minister: save rate for a specific member
  async function saveMemberRate(memberId: string) {
    const r = Number(editingRateValue);
    if (Number.isNaN(r) || r < 0) {
      toast.error("Enter a valid rate.");
      return;
    }
    setSavingRateForMember(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: me.memberId, targetMemberId: memberId, ratePerKela: r }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to save.");
      } else {
        toast.success(`Rate updated for ${data.member.name}.`);
        setEditingRateId(null);
        refreshData();
      }
    } finally {
      setSavingRateForMember(false);
    }
  }

  function startEditingRate(memberId: string, currentRate: number) {
    setEditingRateId(memberId);
    setEditingRateValue(String(currentRate));
  }

  // Minister: record a payment for an incident
  async function handleSettle(incidentId: string, paidAmount: number) {
    try {
      const res = await fetch(`/api/rooms/${room.code}/incidents/${incidentId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: me.memberId, paidAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to settle.");
        return;
      }
      if (paidAmount === -1) {
        toast.success("✓ Fine fully settled!");
      } else if (paidAmount === 0) {
        toast.success("Payment reset.");
      } else {
        toast.success(`✓ PKR ${paidAmount} recorded! Remaining: PKR ${data.remaining}`);
      }
      refreshData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to settle.");
    }
  }

  // Minister: delete an incident
  async function handleDeleteIncident(incidentId: string, accusedName: string) {
    if (!confirm(`Delete this kela incident for ${accusedName}? This removes it permanently (votes + fine).`)) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/incidents/${incidentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: me.memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to delete.");
        return;
      }
      toast.success("Incident deleted.");
      refreshData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete.");
    }
  }

  // Minister: remove a member from the room (anonymizes — keeps history as ledger)
  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the room?\n\nTheir kelas, votes, and fines will be PRESERVED in the history as "Removed User" (ledger). They will no longer be able to log in.`)) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/members/${memberId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: me.memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to remove member.");
        return;
      }
      toast.success(`${memberName} removed. History preserved as "Removed User".`);
      refreshData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove member.");
    }
  }

  function handleLeave() {
    localStorage.removeItem(`kela:${room.code}`);
    router.push("/");
  }

  // ---- Compute my fine + minister status ---------------------------------
  // Fine = sum(inc.rateAtTime) - totalPaidAmount (uses historical rates)
  const myGuiltyIncidents = incidents.filter((i) => i.user.id === me.memberId && i.verdict === "kela");
  const myGuiltyCount = myGuiltyIncidents.length;
  const myTotalPaid = myGuiltyIncidents.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const myGrossFine = myGuiltyIncidents.reduce((sum, i) => sum + (i.rateAtTime || i.user.ratePerKela), 0);
  const myFine = Math.max(0, myGrossFine - myTotalPaid);
  const mySettledCount = myGuiltyIncidents.filter((i) => (i.paidAmount || 0) >= (i.rateAtTime || i.user.ratePerKela)).length;
  const myMember = members.find((m) => m.id === me.memberId);
  // Minister = has "minister" role OR is the room host (hostEmail matches my email)
  const isMinister = myMember?.role === "minister" || (myMember?.email && myMember.email === room.hostEmail);

  // ---- Render -----------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="container mx-auto max-w-6xl p-4 space-y-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-4xl">🍌</div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-yellow-950 truncate">{room.name}</h1>
              <p className="text-xs text-muted-foreground">
                Hi, {me.memberName}!{isMinister && <span className="text-yellow-700 font-semibold"> 👑 Kela Minister</span>} · Code: <button onClick={copyInviteLink} className="font-mono font-semibold text-yellow-800 hover:underline">{room.code}</button>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMinister && (
              <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                <Mail className="h-4 w-4 mr-1" /> Invite
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-1" /> Leave
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* My fine summary */}
          <Card className="md:col-span-2 bg-gradient-to-br from-yellow-300 to-amber-400 border-yellow-400 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-yellow-900/70">Your Total Fine Due</div>
                  <div className="text-4xl font-bold text-yellow-950 mt-1">PKR {myFine.toLocaleString()}</div>
                  <div className="text-sm text-yellow-900/80 mt-1">
                    {myGuiltyCount} kela{myGuiltyCount === 1 ? "" : "s"} · PKR {myGrossFine.toLocaleString()} total
                    {myTotalPaid > 0 && (
                      <span> · PKR {myTotalPaid.toLocaleString()} paid</span>
                    )}
                    {mySettledCount > 0 && (
                      <span className="text-green-700"> · {mySettledCount} settled ✓</span>
                    )}
                  </div>
                  {/* My badge */}
                  {(() => {
                    const badge = getBadge(myGuiltyCount);
                    const next = getNextBadge(myGuiltyCount);
                    return (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {badge ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${badge.color} bg-white`}>
                            {badge.emoji} {badge.title}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium bg-white/60 text-yellow-900/60 border-yellow-300/50">
                            No badge yet
                          </span>
                        )}
                        {next && (
                          <span className="text-xs text-yellow-900/70">
                            → Next: {next.emoji} {next.title} at {next.minKelas} kelas
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="text-7xl opacity-30">🍌</div>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Rate</CardTitle>
              <CardDescription className="text-xs">Fine charged per confirmed kela against you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">PKR</span>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={saveRate} disabled={savingRate}>
                  {savingRate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Share link banner — only minister sees this */}
        {isMinister && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Users className="h-5 w-5 text-yellow-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-yellow-900">Invite friends to this room</div>
              <div className="text-xs text-yellow-800/80 truncate">{shareUrl}</div>
            </div>
            <Button size="sm" variant="outline" onClick={copyInviteLink} className="bg-white">
              {copied ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="bg-white">
              <Mail className="h-4 w-4 mr-1" /> Invite by Email
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Sound Manager — only visible to the Kela Minister */}
        {isMinister && (
          <SoundManager
            roomCode={room.code}
            memberId={me.memberId}
            onSoundsChanged={() => {}}
          />
        )}

        {/* Kela Leaderboard */}
        {members.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                🏆 Kela Leaderboard
              </CardTitle>
              <CardDescription>
                Who&apos;s eaten the most kela? Per-person breakdown of kelas eaten, rate, and total fine due.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const ranked = members
                  .map((m) => {
                    const guilty = incidents.filter((i) => i.user.id === m.id && i.verdict === "kela").length;
                    const memberIncidents = incidents.filter((i) => i.user.id === m.id && i.verdict === "kela");
                    const totalPaid = memberIncidents.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
                    const grossFine = memberIncidents.reduce((sum, i) => sum + (i.rateAtTime || i.user.ratePerKela), 0);
                    const totalAccused = incidents.filter((i) => i.user.id === m.id).length;
                    return {
                      ...m,
                      guilty,
                      totalPaid,
                      totalAccused,
                      totalFine: Math.max(0, grossFine - totalPaid),
                      isMe: m.id === me.memberId,
                    };
                  })
                  .sort((a, b) => {
                    // Sort by guilty desc, then totalFine desc
                    if (b.guilty !== a.guilty) return b.guilty - a.guilty;
                    return b.totalFine - a.totalFine;
                  });

                if (ranked.every((r) => r.guilty === 0)) {
                  return (
                    <div className="text-center py-6 text-muted-foreground">
                      <div className="text-3xl mb-1">🕊️</div>
                      <p className="text-sm font-medium">No one has eaten kela yet. Peaceful.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {ranked.map((m, idx) => {
                      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center gap-3 rounded-lg p-3 border ${
                            m.isMe ? "bg-yellow-50 border-yellow-300" : "bg-card border-border"
                          }`}
                        >
                          <div className="text-xl font-bold w-8 text-center flex-shrink-0">{medal}</div>
                          <Avatar className="h-9 w-9 bg-yellow-200 text-yellow-900 flex-shrink-0">
                            <AvatarFallback className="text-xs">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate flex items-center gap-1">
                              {m.role === "minister" && <Crown className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />}
                              <span className="truncate">{m.name}</span>
                              {m.isMe && <span className="text-xs text-yellow-700 font-normal">(you)</span>}
                              {(() => { const b = getBadge(m.guilty); return b ? <span className="text-sm flex-shrink-0">{b.emoji}</span> : null; })()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {m.guilty} kela{m.guilty === 1 ? "" : "s"} · PKR {m.ratePerKela}/kela
                              {m.role === "minister" && " · 👑 Minister"}
                              {(() => { const b = getBadge(m.guilty); return b ? ` · ${b.title}` : ""; })()}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-sm text-red-700">PKR {m.totalFine.toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">fine due</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Badge Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">🏅 Badge Legend</CardTitle>
            <CardDescription>
              Earn badges by eating kela. The more kelas you eat, the higher your rank. Badges are permanent achievements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {BADGE_TIERS.map((tier) => (
                <div
                  key={tier.minKelas}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${tier.color}`}
                >
                  <div className="text-3xl flex-shrink-0">{tier.emoji}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{tier.title}</div>
                    <div className="text-xs opacity-80">{tier.tier} · {tier.minKelas}+ kelas</div>
                    <div className="text-[11px] opacity-70 truncate">{tier.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Members grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Friend Circle
              <Badge variant="secondary" className="ml-1">{members.length}</Badge>
            </CardTitle>
            <CardDescription>
              Spot someone eating kela? Click <b>Kelaaaa</b> to start a vote. Everyone except the accused will get a popup to vote 🍌 or 🍎.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length <= 1 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="text-4xl mb-2">👋</div>
                <p className="font-medium">You&apos;re the only one here so far.</p>
                <p className="text-sm mt-1">Invite friends by email or share the room code <button onClick={copyInviteLink} className="font-mono font-semibold text-yellow-800 hover:underline">{room.code}</button>.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.filter((m) => m.id !== me.memberId).map((m) => {
                  const memberIncidents = incidents.filter((i) => i.user.id === m.id && i.verdict === "kela");
                  const guilty = memberIncidents.length;
                  const totalPaid = memberIncidents.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
                  const grossFine = memberIncidents.reduce((sum, i) => sum + (i.rateAtTime || i.user.ratePerKela), 0);
                  const totalAccused = incidents.filter((i) => i.user.id === m.id).length;
                  const totalFine = Math.max(0, grossFine - totalPaid);
                  return (
                    <div key={m.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 bg-yellow-200 text-yellow-900">
                          <AvatarFallback>{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate flex items-center gap-1">
                            {m.role === "minister" && <Crown className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />}
                            <span className="truncate">{m.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {m.role === "minister" ? "Kela Minister" : m.email}
                          </div>
                        </div>
                      </div>
                      {/* Per-person kela stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2">
                          <div className="text-lg font-bold text-yellow-900">{guilty}</div>
                          <div className="text-[10px] text-yellow-700 font-medium leading-tight">Kelas eaten</div>
                        </div>
                        <div className="rounded-lg bg-muted border p-2">
                          {isMinister && editingRateId === m.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={editingRateValue}
                                onChange={(e) => setEditingRateValue(e.target.value)}
                                className="w-14 text-center text-sm font-bold border rounded px-1 py-0.5"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveMemberRate(m.id);
                                  if (e.key === "Escape") setEditingRateId(null);
                                }}
                              />
                              <button
                                onClick={() => saveMemberRate(m.id)}
                                disabled={savingRateForMember}
                                className="text-xs font-bold text-green-600 hover:text-green-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingRateId(null)}
                                className="text-xs font-bold text-red-500 hover:text-red-600"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => isMinister && startEditingRate(m.id, m.ratePerKela)}
                              className="w-full"
                              title={isMinister ? "Click to edit rate" : undefined}
                            >
                              <div className={`text-lg font-bold ${isMinister ? "cursor-pointer hover:text-yellow-600" : ""}`}>PKR {m.ratePerKela}</div>
                            </button>
                          )}
                          <div className="text-[10px] text-muted-foreground font-medium leading-tight">
                            {isMinister ? "Rate/kela (click to edit)" : "Rate/kela"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-200 p-2">
                          <div className="text-lg font-bold text-red-700">PKR {totalFine.toLocaleString()}</div>
                          <div className="text-[10px] text-red-600 font-medium leading-tight">Fine due</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        {totalAccused} accusation{totalAccused === 1 ? "" : "s"} total
                      </div>
                      {(() => {
                        const badge = getBadge(guilty);
                        return badge ? (
                          <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full border text-xs font-bold ${badge.color}`}>
                            {badge.emoji} {badge.title}
                          </div>
                        ) : null;
                      })()}
                      {m.name !== "Removed User" && (
                        <Button
                          size="sm"
                          className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950"
                          onClick={() => { setAccuseTarget(m); setAccuseReason(""); }}
                        >
                          🍌 Kelaaaa
                        </Button>
                      )}
                      {isMinister && m.name !== "Removed User" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                          onClick={() => handleRemoveMember(m.id, m.name)}
                        >
                          🗑 Remove Member
                        </Button>
                      )}
                      {m.name === "Removed User" && (
                        <div className="text-xs text-center text-muted-foreground italic py-1">
                          🔒 Removed — history preserved
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📜 Recent Kela Trials</CardTitle>
            <CardDescription>The latest accusations and verdicts in this room.</CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="text-4xl mb-2">🕊️</div>
                <p className="font-medium">No incidents yet. Peaceful.</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-3 pr-2">
                  {incidents.map((inc) => (
                    <div key={inc.id} className="rounded-lg border p-3 bg-card">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 bg-yellow-200 text-yellow-900">
                            <AvatarFallback className="text-xs">{inc.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{inc.user.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(inc.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <VerdictBadge verdict={inc.verdict} />
                      </div>
                      {inc.reason && (
                        <div className="text-sm text-muted-foreground italic mt-1">&ldquo;{inc.reason}&rdquo;</div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>🍌 {inc.votesYes}</span>
                        <span>🍎 {inc.votesNo}</span>
                        <span>·</span>
                        <span>by {inc.accusedBy.name}</span>
                        <span>·</span>
                        <span>{inc.votes.length} voter{inc.votes.length === 1 ? "" : "s"}</span>
                        {inc.verdict === "kela" && (
                          <>
                            <span>·</span>
                            <span>Fine: PKR {inc.rateAtTime || inc.user.ratePerKela}</span>
                            {(inc.paidAmount || 0) > 0 && (
                              <span className="text-green-600 font-semibold">· Paid: PKR {inc.paidAmount}</span>
                            )}
                            {(inc.paidAmount || 0) >= (inc.rateAtTime || inc.user.ratePerKela) && (
                              <span className="text-green-600 font-semibold">· ✓ Settled</span>
                            )}
                          </>
                        )}
                      </div>
                      {/* Minister actions: settle payment + delete (only for kela verdict) */}
                      {isMinister && inc.verdict === "kela" && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {(() => {
                            const rate = inc.rateAtTime || inc.user.ratePerKela;
                            const paid = inc.paidAmount || 0;
                            const remaining = Math.max(0, rate - paid);
                            const fullySettled = paid >= rate;
                            return (
                              <>
                                <input
                                  type="number"
                                  placeholder={`Pay (max ${remaining})`}
                                  min={0}
                                  max={remaining}
                                  className="w-28 text-sm border rounded px-2 py-1"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = Number((e.target as HTMLInputElement).value);
                                      if (val > 0) handleSettle(inc.id, val);
                                      (e.target as HTMLInputElement).value = "";
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    const input = document.querySelector(`input[data-incident="${inc.id}"]`) as HTMLInputElement;
                                    if (input) {
                                      const val = Number(input.value);
                                      if (val > 0) {
                                        handleSettle(inc.id, val);
                                        input.value = "";
                                      } else {
                                        toast.error("Enter a valid amount.");
                                      }
                                    } else {
                                      // Fallback: prompt
                                      const val = Number(prompt(`Enter amount to pay (remaining: PKR ${remaining}):`));
                                      if (val > 0) handleSettle(inc.id, val);
                                    }
                                  }}
                                  className="h-7 text-xs"
                                  disabled={fullySettled}
                                >
                                  💵 Pay
                                </Button>
                                {!fullySettled && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSettle(inc.id, -1)}
                                    className="h-7 text-xs"
                                  >
                                    ✓ Settle Full
                                  </Button>
                                )}
                                {paid > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSettle(inc.id, 0)}
                                    className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  >
                                    ↩ Reset Payment
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteIncident(inc.id, inc.user.name)}
                                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  🗑 Delete
                                </Button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {isMinister && inc.verdict === "saeb" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteIncident(inc.id, inc.user.name)}
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            🗑 Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <footer className="text-center text-xs text-muted-foreground pb-4 pt-2">
          Made with 🍌 · Real-time Among Us-style voting · Sound on for the full experience 🔊
        </footer>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a friend</DialogTitle>
            <DialogDescription>
              Add a friend to the room. Their email is used as their identity (no actual email is sent). Share the room link with them so they can join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="inviteName">Friend&apos;s Name (optional)</Label>
              <Input
                id="inviteName"
                placeholder="e.g. Bilal"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Friend&apos;s Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            {/* Role selection */}
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInviteRole("member")}
                  className={`rounded-lg border p-3 text-left transition ${inviteRole === "member" ? "border-yellow-400 bg-yellow-50" : "border-border bg-card hover:bg-muted"}`}
                >
                  <div className="font-semibold text-sm">👤 Member</div>
                  <div className="text-xs text-muted-foreground">Can vote & be accused</div>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole("minister")}
                  className={`rounded-lg border p-3 text-left transition ${inviteRole === "minister" ? "border-yellow-400 bg-yellow-50" : "border-border bg-card hover:bg-muted"}`}
                >
                  <div className="font-semibold text-sm">👑 Kela Minister</div>
                  <div className="text-xs text-muted-foreground">Can invite, set rates & manage sounds</div>
                </button>
              </div>
            </div>
            {/* Rate per kela */}
            <div className="space-y-2">
              <Label htmlFor="inviteRate">Fine per Kela (PKR)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">PKR</span>
                <Input
                  id="inviteRate"
                  type="number"
                  min={0}
                  step={5}
                  value={inviteRate}
                  onChange={(e) => setInviteRate(e.target.value)}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">per kela</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              💡 We&apos;ll pre-add them to the room so you can accuse them right away. Share the room code <span className="font-mono font-semibold">{room.code}</span> with them so they can join and vote too.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyInviteLink}>
              {copied ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
              Copy Link
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accuse dialog */}
      <AlertDialog open={!!accuseTarget} onOpenChange={(o) => { if (!o) setAccuseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accuse {accuseTarget?.name} of eating kela?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start a vote. Every other online member will get a popup to vote 🍌 Kela or 🍎 Saeb. {accuseTarget?.name} cannot vote.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g. got offended at my cricket joke"
              value={accuseReason}
              onChange={(e) => setAccuseReason(e.target.value)}
              maxLength={200}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleStartVote(); }}
              disabled={startingVote}
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950"
            >
              {startingVote ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Start Vote 🍌
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active vote modal (I'm a voter) */}
      <VoteModal
        open={voteOpen}
        activeVote={activeVote}
        onVote={handleCastVote}
        votedChoice={votedChoice}
      />

      {/* Accused modal (I'm the accused) */}
      <AccusedModal
        open={accusedOpen}
        activeVote={activeVote}
        onClose={() => setAccusedOpen(false)}
      />

      {/* Result modal */}
      <ResultModal
        open={resultOpen}
        endedVote={endedVote}
        onClose={() => { setResultOpen(false); dismissEndedVote(); }}
      />
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "kela") return <Badge className="bg-yellow-400 hover:bg-yellow-400 text-yellow-950">🍌 Kela</Badge>;
  if (verdict === "saeb") return <Badge variant="outline" className="border-red-300 text-red-700">🍎 Saeb</Badge>;
  if (verdict === "tie") return <Badge variant="secondary">🤷 Tie</Badge>;
  return <Badge variant="secondary">⏳ Pending</Badge>;
}

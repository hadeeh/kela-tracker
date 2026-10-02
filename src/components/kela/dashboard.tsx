"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, LogOut, Wifi, WifiOff, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useSocket, type VoteStartedPayload, type VoteUpdatePayload, type VoteEndedPayload, type AccusedPayload } from "./use-socket";
import { VoteModal } from "./vote-modal";
import { AccusedModal, ResultModal } from "./modals";

type Me = { id: string; name: string; email: string; ratePerKela: number };
type Friend = {
  id: string;
  name: string;
  email: string;
  ratePerKela: number;
  createdAt: string;
  _count: { incidents: number };
};

type Incident = {
  id: string;
  userId: string;
  reason: string | null;
  accusedBy: string;
  votesYes: number;
  votesNo: number;
  verdict: string;
  createdAt: string;
  user: { id: string; name: string; email: string; ratePerKela: number };
  votes: { id: string; choice: string; voter: { id: string; name: string } }[];
};

export function Dashboard({ me }: { me: Me }) {
  // ---- Data state -------------------------------------------------------
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [myGuiltyCount, setMyGuiltyCount] = useState(0);
  const [myFine, setMyFine] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);

  // ---- Settings state ---------------------------------------------------
  const [rateInput, setRateInput] = useState(String(me.ratePerKela));
  const [savingRate, setSavingRate] = useState(false);

  // ---- Vote / accuse modal state ---------------------------------------
  const [accuseTarget, setAccuseTarget] = useState<Friend | null>(null);
  const [accuseReason, setAccuseReason] = useState("");
  const [startingVote, setStartingVote] = useState(false);

  // Active vote modal (when I'm a voter)
  const [voteOpen, setVoteOpen] = useState(false);
  const [votePayload, setVotePayload] = useState<VoteStartedPayload | null>(null);
  const [voteUpdate, setVoteUpdate] = useState<VoteUpdatePayload | null>(null);
  const [votedChoice, setVotedChoice] = useState<"kela" | "saeb" | null>(null);

  // Accused modal (when I am the accused)
  const [accusedOpen, setAccusedOpen] = useState(false);
  const [accusedPayload, setAccusedPayload] = useState<AccusedPayload | null>(null);

  // Result modal
  const [resultOpen, setResultOpen] = useState(false);
  const [resultPayload, setResultPayload] = useState<VoteEndedPayload | null>(null);

  // ---- Handlers for socket events --------------------------------------
  const onVoteStarted = useCallback((p: VoteStartedPayload) => {
    // Skip if it's me being accused (we'll get 'accused' instead)
    if (p.accusedId === me.id) return;
    setVotePayload(p);
    setVoteUpdate(null);
    setVotedChoice(null);
    setVoteOpen(true);
    toast.message(`🍌 Vote started against ${p.accusedName}!`);
  }, [me.id]);

  const onAccused = useCallback((p: AccusedPayload) => {
    setAccusedPayload(p);
    setAccusedOpen(true);
  }, []);

  const onVoteUpdate = useCallback((p: VoteUpdatePayload) => {
    setVoteUpdate(p);
  }, []);

  const onVoteEnded = useCallback((p: VoteEndedPayload) => {
    // Close any open vote/accused modals for this incident
    setVoteOpen(false);
    setAccusedOpen(false);
    setVotePayload(null);
    setVotedChoice(null);

    setResultPayload(p);
    setResultOpen(true);

    // Refresh data after a short delay
    setTimeout(() => { refreshData(); }, 400);

    // Toast
    if (p.verdict === "kela") {
      toast.success(`🍌 ${p.accusedName} confirmed kela! Fine added.`);
    } else if (p.verdict === "saeb") {
      toast.info(`🍎 ${p.accusedName} is innocent. Saeb!`);
    } else {
      toast.message(`🤷 It's a tie for ${p.accusedName}.`);
    }
  }, []);

  const onOnlineCount = useCallback((n: number) => setOnlineCount(n), []);

  const { connected, startVote, castVote } = useSocket(me.id, me.name, {
    onVoteStarted,
    onAccused,
    onVoteUpdate,
    onVoteEnded,
    onOnlineCount,
  });

  // ---- Data fetching ----------------------------------------------------
  const refreshData = useCallback(async () => {
    try {
      const [usersRes, incRes] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/incidents", { cache: "no-store" }),
      ]);
      if (usersRes.ok) {
        const ud = await usersRes.json();
        setFriends(ud.users || []);
      }
      if (incRes.ok) {
        const id = await incRes.json();
        setIncidents(id.incidents || []);
        setMyGuiltyCount(id.myGuiltyCount ?? 0);
        setMyFine(id.myFine ?? 0);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const id = setInterval(refreshData, 15_000);
    return () => clearInterval(id);
  }, [refreshData]);

  // ---- Actions ----------------------------------------------------------
  async function handleStartVote() {
    if (!accuseTarget) return;
    setStartingVote(true);
    const result = await startVote({
      accusedId: accuseTarget.id,
      accusedName: accuseTarget.name,
      reason: accuseReason.trim() || null,
    });
    setStartingVote(false);
    if (!result) {
      toast.error("Could not start vote. Try again.");
      return;
    }
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`🍌 Vote started against ${accuseTarget.name}!`);
    setAccuseTarget(null);
    setAccuseReason("");
  }

  async function handleCastVote(choice: "kela" | "saeb") {
    if (!votePayload) return;
    const r = await castVote({ incidentId: votePayload.incidentId, choice });
    if (!r || r.error) {
      toast.error(r?.error || "Vote failed.");
      return;
    }
    setVotedChoice(choice);
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
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePerKela: r }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to save.");
      } else {
        toast.success("Rate updated.");
        me.ratePerKela = data.ratePerKela;
        refreshData();
      }
    } finally {
      setSavingRate(false);
    }
  }

  // ---- Render -----------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="container mx-auto max-w-6xl p-4 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🍌</div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-yellow-950">Kela Tracker</h1>
              <p className="text-xs text-muted-foreground">Hi, {me.name}!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-green-500 hover:bg-green-500 text-white" : ""}>
              {connected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {connected ? "Online" : "Offline"}
            </Badge>
            <Badge variant="outline">{onlineCount} online</Badge>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
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
                    {myGuiltyCount} kela{myGuiltyCount === 1 ? "" : "s"} confirmed against you
                  </div>
                </div>
                <div className="text-7xl opacity-30">🍌</div>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Your Rate
              </CardTitle>
              <CardDescription className="text-xs">
                Fine charged per confirmed kela against you.
              </CardDescription>
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

        {/* Friends grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">👥 Your Friend Circle</CardTitle>
            <CardDescription>
              Spot someone eating kela? Click <b>Accuse of Kela</b> to start a vote. Everyone except the accused will get a popup to vote 🍌 or 🍎.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="text-4xl mb-2">👋</div>
                <p className="font-medium">No other friends registered yet.</p>
                <p className="text-sm mt-1">Tell your friends to sign up at this same URL with their email.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {friends.map((f) => (
                  <div key={f.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 bg-yellow-200 text-yellow-900">
                        <AvatarFallback>{f.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{f.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-900 hover:bg-yellow-100">
                        PKR {f.ratePerKela}/kela
                      </Badge>
                      <span className="text-muted-foreground">
                        {f._count.incidents} accusation{f._count.incidents === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950"
                      onClick={() => { setAccuseTarget(f); setAccuseReason(""); }}
                    >
                      🍌 Accuse of Kela
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📜 Recent Kela Trials</CardTitle>
            <CardDescription>The latest accusations and verdicts across your friend circle.</CardDescription>
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
                        <span>{inc.votes.length} voter{inc.votes.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <footer className="text-center text-xs text-muted-foreground pb-4 pt-2">
          Made with 🍌 · Real-time Among Us-style voting · Open in multiple browsers to test
        </footer>
      </div>

      {/* Accuse dialog */}
      <AlertDialog open={!!accuseTarget} onOpenChange={(o) => { if (!o) setAccuseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accuse {accuseTarget?.name} of eating kela?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start a vote. Every other online user will get a popup to vote 🍌 Kela or 🍎 Saeb. {accuseTarget?.name} cannot vote.
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
        payload={votePayload}
        updates={voteUpdate}
        onVote={handleCastVote}
        votedChoice={votedChoice}
      />

      {/* Accused modal (I'm the accused) */}
      <AccusedModal
        open={accusedOpen}
        payload={accusedPayload}
        onClose={() => setAccusedOpen(false)}
      />

      {/* Result modal */}
      <ResultModal
        open={resultOpen}
        payload={resultPayload}
        isAccusedMe={resultPayload?.accusedId === me.id}
        onClose={() => setResultOpen(false)}
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

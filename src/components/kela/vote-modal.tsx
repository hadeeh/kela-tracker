"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Clock } from "lucide-react";
import type { ActiveVote } from "./use-polling";
import { KelaRadar } from "./kela-radar";

type Props = {
  open: boolean;
  activeVote: ActiveVote | null;
  onVote: (choice: "kela" | "saeb") => void;
  votedChoice: "kela" | "saeb" | null;
  isMinister?: boolean;
  onSettle?: (action: "kela" | "saeb" | "tie" | "cancel", incidentId: string) => void;
  /** Allow user to manually close the modal while vote is still active */
  onClose?: () => void;
};

function useCountdown(endsAt: number | null | undefined) {
  const [remainingMs, setRemainingMs] = useState<number>(0);

  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return;
    }
    function update() {
      const ms = Math.max(0, (endsAt as number) - Date.now());
      setRemainingMs(ms);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return remainingMs;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function VoteModal({ open, activeVote, onVote, votedChoice, isMinister, onSettle, onClose }: Props) {
  const votesYes = activeVote?.votesYes ?? 0;
  const votesNo = activeVote?.votesNo ?? 0;
  const totalVotes = votesYes + votesNo;
  const remainingMs = useCountdown(activeVote?.voteEndsAt ?? activeVote?.endsAt);
  const isUrgent = remainingMs > 0 && remainingMs < 60_000; // < 1 min left
  const isExpired = remainingMs === 0 && (activeVote?.voteEndsAt ?? activeVote?.endsAt);

  // Trigger an immediate refresh when the countdown hits 0 so the server
  // closes the vote ASAP (don't wait up to 700ms for the next poll cycle).
  const expiredRef = useRef(false);
  useEffect(() => {
    if (isExpired && !expiredRef.current) {
      expiredRef.current = true;
      // Small delay to let the server process the expiry on its next poll
      const id = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("kela-refresh"));
      }, 500);
      return () => clearTimeout(id);
    }
  }, [isExpired]);

  // Dynamic status text based on timer state
  const statusText = isExpired
    ? "Closing — deciding verdict..."
    : isUrgent
    ? "⚠️ Hurry! Less than 1 minute left"
    : "Open — waiting for votes";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && onClose) onClose(); }}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Manual close button (X) — lets user close radar while vote continues */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 rounded-full p-1.5 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close radar (vote continues in background)"
            title="Close — vote continues in background, you'll see results when it ends"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <span className="text-3xl animate-pulse">🍌</span>
            <span>Kela Alert!</span>
          </DialogTitle>
          <DialogDescription className="text-center pt-1">
            Someone has been accused of eating kela.
          </DialogDescription>
        </DialogHeader>

        {activeVote && (
          <div className="space-y-4">
            {/* Countdown timer */}
            {(activeVote.voteEndsAt ?? activeVote.endsAt) && (
              <div className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ${
                isExpired ? "bg-red-100 text-red-700"
                : isUrgent ? "bg-orange-100 text-orange-700 animate-pulse"
                : "bg-blue-50 text-blue-700"
              }`}>
                <Clock className="h-3.5 w-3.5" />
                {isExpired ? (
                  <span>Voting closed — deciding verdict...</span>
                ) : (
                  <span>⏱ {formatCountdown(remainingMs)} remaining</span>
                )}
              </div>
            )}

            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-center">
              <div className="text-xs text-yellow-700 font-medium">Accused</div>
              <div className="text-xl font-bold text-yellow-900 mt-0.5">{activeVote.accusedName}</div>
              {activeVote.reason ? (
                <div className="text-xs text-yellow-800 mt-1.5 italic">🍌 &ldquo;{activeVote.reason}&rdquo;</div>
              ) : (
                <div className="text-xs text-yellow-700 mt-1.5 italic">No reason given</div>
              )}
              <div className="text-[10px] text-yellow-700 mt-1.5">
                Accused by <span className="font-semibold">{activeVote.accusedByName}</span>
              </div>
            </div>

            {/* Defense (if submitted by the accused during voting) */}
            {activeVote.defense && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <div className="text-xs font-bold text-blue-700 uppercase mb-1">🛡️ Defense</div>
                <div className="text-sm text-blue-900 italic">&ldquo;{activeVote.defense}&rdquo;</div>
              </div>
            )}

            {/* ============ KELA RADAR ============ */}
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-green-900/50 p-4">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <span className="text-[10px] uppercase tracking-wider text-green-400 font-bold">
                  📡 Kela Radar
                </span>
              </div>
              <KelaRadar
                accusedName={activeVote.accusedName}
                votesYes={votesYes}
                votesNo={votesNo}
                hasVoted={!!votedChoice}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Vote status</span>
                <span className={`font-semibold ${
                  isExpired ? "text-red-600"
                  : isUrgent ? "text-orange-600"
                  : "text-blue-600"
                }`}>{statusText}</span>
              </div>
              <div className="text-[10px] text-muted-foreground text-center">
                {activeVote.voterCount} voted · Auto-closes at 5:00 or when all vote
              </div>
            </div>

            {votedChoice ? (
              <div className="space-y-3">
                <div className="text-center text-sm text-muted-foreground">
                  You voted <span className="font-bold">{votedChoice === "kela" ? "🍌 Kela" : "🍎 Saeb"}</span>. Waiting for others...
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-yellow-100 border border-yellow-200 p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-900">{votesYes}</div>
                    <div className="text-xs text-yellow-700 font-medium">🍌 Kela</div>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{votesNo}</div>
                    <div className="text-xs text-red-600 font-medium">🍎 Saeb</div>
                  </div>
                </div>
                <div className="text-center text-xs text-muted-foreground">{totalVotes} vote{totalVotes === 1 ? "" : "s"} cast</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  className="h-16 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold text-base flex flex-col gap-1"
                  onClick={() => onVote("kela")}
                >
                  <span className="text-2xl">🍌</span>
                  <span>Kelaaaa</span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-16 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 font-bold text-base flex flex-col gap-1"
                  onClick={() => onVote("saeb")}
                >
                  <span className="text-2xl">🍎</span>
                  <span>SAEB</span>
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              The accused cannot vote. Vote auto-closes in 5 min, when all vote, or when minister settles.
            </p>

            {/* Minister settle controls */}
            {isMinister && onSettle && activeVote && (
              <div className="border-t pt-3 mt-2">
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 text-center">⚡ Minister Controls</div>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] bg-yellow-50" onClick={() => onSettle("kela", activeVote.incidentId)}>🍌 Force Kela</Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] bg-red-50" onClick={() => onSettle("saeb", activeVote.incidentId)}>🍎 Force Saeb</Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onSettle("tie", activeVote.incidentId)}>🤷 Force Tie</Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600" onClick={() => onSettle("cancel", activeVote.incidentId)}>✕ Cancel Vote</Button>
                </div>
                <p className="text-[9px] text-muted-foreground text-center mt-1">Use if members are offline or to end early.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

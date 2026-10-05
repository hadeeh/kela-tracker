"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActiveVote } from "./use-polling";

type Props = {
  open: boolean;
  activeVote: ActiveVote | null;
  onVote: (choice: "kela" | "saeb") => void;
  votedChoice: "kela" | "saeb" | null;
};

function useCountdown(endsAt: number | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

export function VoteModal({ open, activeVote, onVote, votedChoice }: Props) {
  const remaining = useCountdown(activeVote?.endsAt ?? null);
  const votesYes = activeVote?.votesYes ?? 0;
  const votesNo = activeVote?.votesNo ?? 0;
  const totalVotes = votesYes + votesNo;

  const progressPct = useMemo(() => {
    if (!activeVote) return 0;
    const total = Math.max(1, Math.round((activeVote.endsAt - activeVote.startedAt) / 1000));
    return Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
  }, [activeVote, remaining]);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-center">
              <div className="text-sm text-yellow-700 font-medium">Accused</div>
              <div className="text-2xl font-bold text-yellow-900 mt-1">{activeVote.accusedName}</div>
              {activeVote.reason ? (
                <div className="text-sm text-yellow-800 mt-2 italic">&ldquo;{activeVote.reason}&rdquo;</div>
              ) : (
                <div className="text-sm text-yellow-700 mt-2 italic">No reason given</div>
              )}
              <div className="text-xs text-yellow-700 mt-2">
                Accused by <span className="font-semibold">{activeVote.accusedByName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Time remaining</span>
                <span className="font-mono font-semibold">{remaining}s</span>
              </div>
              <Progress value={progressPct} className="h-2" />
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
              The accused cannot vote. Vote closes automatically.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

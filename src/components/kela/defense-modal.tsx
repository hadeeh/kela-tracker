"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { DefensePhase } from "./use-polling";

type Props = {
  open: boolean;
  defensePhase: DefensePhase | null;
  onSubmit: (defense: string) => void;
  submitting: boolean;
};

export function DefenseModal({ open, defensePhase, onSubmit, submitting }: Props) {
  const [defense, setDefense] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!defensePhase) return;
    setDefense("");
    const tick = () => {
      const left = Math.max(0, Math.ceil((defensePhase.defenseDeadline - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [defensePhase]);

  if (!defensePhase) return null;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <span className="text-3xl">⚖️</span>
            <span>You&apos;ve Been Accused!</span>
          </DialogTitle>
          <DialogDescription className="text-center pt-1">
            <span className="font-semibold text-foreground">{defensePhase.accusedByName}</span> thinks you ate kela.
            Type your defense — voting begins after you submit!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Accusation */}
          <div className="rounded-xl bg-red-50 border border-red-200 p-3">
            <div className="text-xs font-bold text-red-700 uppercase mb-1">🍌 Accusation</div>
            <div className="text-sm text-red-900 italic">
              {defensePhase.reason ? `"${defensePhase.reason}"` : "No reason given"}
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Time to respond:</span>
            <span className={`font-mono font-bold ${timeLeft <= 5 ? "text-red-600" : "text-yellow-700"}`}>
              {timeLeft}s
            </span>
          </div>

          {/* Defense input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">🛡️ Your Defense</label>
            <Textarea
              placeholder="e.g. I was just joking bro! That wasn't even offensive..."
              value={defense}
              onChange={(e) => setDefense(e.target.value)}
              maxLength={200}
              rows={3}
              autoFocus
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  if (defense.trim()) onSubmit(defense.trim());
                }
              }}
            />
            <div className="text-xs text-muted-foreground text-right">{defense.length}/200</div>
          </div>

          <Button
            className="w-full"
            disabled={!defense.trim() || submitting || timeLeft <= 0}
            onClick={() => onSubmit(defense.trim())}
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            🛡️ Submit Defense & Start Vote
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            ⚠️ If you don&apos;t respond in time, the vote will be cancelled.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { ActiveVote, EndedVote } from "./use-polling";

type Props = {
  open: boolean;
  activeVote: ActiveVote | null;
  onSubmitDefense: (defense: string) => void;
  submittingDefense: boolean;
  onClose: () => void;
};

export function AccusedModal({ open, activeVote, onSubmitDefense, submittingDefense, onClose }: Props) {
  const [defense, setDefense] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (activeVote?.defense) {
      setDefense(activeVote.defense);
      setSubmitted(true);
    } else {
      setDefense("");
      setSubmitted(false);
    }
  }, [activeVote?.incidentId, activeVote?.defense]);

  if (!activeVote) return null;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <span className="text-3xl">⚖️</span>
            <span>You&apos;ve been accused!</span>
          </DialogTitle>
          <DialogDescription className="text-center pt-1">
            <span className="font-semibold text-foreground">{activeVote.accusedByName}</span> thinks you ate kela.
            Voting is in progress — add your defense below!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Accusation */}
          <div className="rounded-xl bg-red-50 border border-red-200 p-3">
            <div className="text-xs font-bold text-red-700 uppercase mb-1">🍌 Accusation</div>
            <div className="text-sm text-red-900 italic">
              {activeVote.reason ? `"${activeVote.reason}"` : "No reason given"}
            </div>
          </div>

          {/* Defense input (optional — can be submitted during voting) */}
          {!submitted ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold">🛡️ Your Defense (optional)</label>
              <Textarea
                placeholder="e.g. I was just joking bro! That wasn't even offensive..."
                value={defense}
                onChange={(e) => setDefense(e.target.value)}
                maxLength={200}
                rows={2}
                disabled={submittingDefense}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{defense.length}/200</div>
                <Button
                  size="sm"
                  disabled={!defense.trim() || submittingDefense}
                  onClick={() => {
                    onSubmitDefense(defense.trim());
                    setSubmitted(true);
                  }}
                >
                  {submittingDefense ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  🛡️ Submit Defense
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Voting continues while you type. If you don&apos;t submit, voting proceeds without your defense.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <div className="text-xs font-bold text-blue-700 uppercase mb-1">🛡️ Your Defense</div>
              <div className="text-sm text-blue-900 italic">"{defense}"</div>
              <div className="text-[10px] text-blue-600 mt-1">✓ Submitted — voters can see it now</div>
            </div>
          )}

          <Button className="w-full" variant="outline" onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Result Modal ----
type ResultProps = {
  open: boolean;
  endedVote: EndedVote | null;
  onClose: () => void;
};

export function ResultModal({ open, endedVote, onClose }: ResultProps) {
  if (!endedVote) return null;

  const isGuilty = endedVote.verdict === "kela";
  const isInnocent = endedVote.verdict === "saeb";
  const isTie = endedVote.verdict === "tie";

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl flex items-center justify-center gap-2">
            {isGuilty && <span className="text-4xl">🍌</span>}
            {isInnocent && <span className="text-4xl">🍎</span>}
            {isTie && <span className="text-4xl">🤷</span>}
            <span>
              {isGuilty ? "Kela Confirmed!" : isInnocent ? "Saeb! Innocent!" : "It's a Tie!"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {endedVote.isAccusedMe
              ? isGuilty
                ? "You ate kela. Fine added. 💸"
                : isInnocent
                ? "Phew! You're off the hook."
                : "Jury couldn't decide. No fine."
              : `${endedVote.accusedName} ${isGuilty ? "is guilty" : isInnocent ? "is innocent" : "got a tie"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show reason + defense */}
          {endedVote.reason && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="text-xs font-bold text-red-700 uppercase mb-1">🍌 Accusation by {endedVote.accusedByName}</div>
              <div className="text-sm text-red-900 italic">"{endedVote.reason}"</div>
            </div>
          )}
          {endedVote.defense && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="text-xs font-bold text-blue-700 uppercase mb-1">🛡️ Defense by {endedVote.accusedName}</div>
              <div className="text-sm text-blue-900 italic">"{endedVote.defense}"</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-4 text-center border ${isGuilty ? "bg-yellow-100 border-yellow-300" : "bg-muted border-border"}`}>
              <div className="text-3xl font-bold">{endedVote.votesYes}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">🍌 Kela</div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${isInnocent ? "bg-red-50 border-red-300" : "bg-muted border-border"}`}>
              <div className="text-3xl font-bold">{endedVote.votesNo}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">🍎 Saeb</div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-center text-sm">
            <div className="font-medium">{endedVote.accusedName}</div>
            <div className="text-muted-foreground text-xs mt-1">
              accused by {endedVote.accusedByName}
            </div>
          </div>

          <Button className="w-full" onClick={onClose}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

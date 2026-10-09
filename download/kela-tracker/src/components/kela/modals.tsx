"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VoteEndedPayload } from "./use-socket";

type Props = {
  open: boolean;
  payload: VoteEndedPayload | null;
  isAccusedMe: boolean;
  onClose: () => void;
};

export function AccusedModal({ open, payload, onClose }: Omit<Props, "isAccusedMe">) {
  if (!payload) return null;
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <span className="text-3xl">⚖️</span>
            <span>You&apos;ve been accused!</span>
          </DialogTitle>
          <DialogDescription className="text-center pt-1">
            <span className="font-semibold text-foreground">{payload.accusedByName}</span> thinks you ate kela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-center">
            <div className="text-sm text-yellow-700 font-medium">Reason</div>
            <div className="text-sm text-yellow-900 mt-1 italic">
              {payload.reason ? `"${payload.reason}"` : "No reason given"}
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            You cannot vote in your own trial. Sit tight while your friends decide your fate... 🍌
          </p>
          <Button className="w-full" variant="outline" onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ResultModal({ open, payload, isAccusedMe, onClose }: Props) {
  if (!payload) return null;

  const isGuilty = payload.verdict === "kela";
  const isInnocent = payload.verdict === "saeb";
  const isTie = payload.verdict === "tie";

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
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
            {isAccusedMe
              ? isGuilty
                ? "You ate kela. Fine added. 💸"
                : isInnocent
                ? "Phew! You're off the hook."
                : "Jury couldn't decide. No fine."
              : `${payload.accusedName} ${isGuilty ? "is guilty" : isInnocent ? "is innocent" : "got a tie"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-4 text-center border ${isGuilty ? "bg-yellow-100 border-yellow-300" : "bg-muted border-border"}`}>
              <div className="text-3xl font-bold">{payload.votesYes}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">🍌 Kela</div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${isInnocent ? "bg-red-50 border-red-300" : "bg-muted border-border"}`}>
              <div className="text-3xl font-bold">{payload.votesNo}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">🍎 Saeb</div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-center text-sm">
            <div className="font-medium">{payload.accusedName}</div>
            <div className="text-muted-foreground text-xs mt-1">
              accused by {payload.accusedByName}
              {payload.reason ? ` · "${payload.reason}"` : ""}
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

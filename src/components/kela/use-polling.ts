"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---- Types ----------------------------------------------------------------
export type ActiveVote = {
  incidentId: string;
  accusedId: string;
  accusedName: string;
  accusedById: string;
  accusedByName: string;
  reason: string | null;
  defense: string | null;
  startedAt: number;
  endsAt: number;
  votesYes: number;
  votesNo: number;
  voterCount: number;
  myVote: "kela" | "saeb" | null;
  isAccused: boolean;
};

export type EndedVote = {
  incidentId: string;
  accusedId: string;
  accusedName: string;
  accusedById: string;
  accusedByName: string;
  reason: string | null;
  defense: string | null;
  votesYes: number;
  votesNo: number;
  verdict: "kela" | "saeb" | "tie";
  isAccusedMe: boolean;
};

export type DefensePhase = {
  incidentId: string;
  accusedId: string;
  accusedName: string;
  accusedById: string;
  accusedByName: string;
  reason: string | null;
  defenseDeadline: number;
  timeLeft: number;
  isAccused: boolean;
};

type PollResponse = {
  activeVote: ActiveVote | null;
  endedVote: EndedVote | null;
  defensePhase: DefensePhase | null;
  defenseExpired?: boolean;
  accusedName?: string;
};

type Handlers = {
  onVoteStarted?: (v: ActiveVote) => void;
  onAccused?: (v: ActiveVote) => void;
  onVoteUpdate?: (votesYes: number, votesNo: number, lastChoice: "kela" | "saeb") => void;
  onVoteEnded?: (v: EndedVote) => void;
  onDefensePhase?: (d: DefensePhase) => void;
  onDefenseExpired?: (accusedName: string) => void;
};

const POLL_INTERVAL_MS = 700;

export function usePolling(
  roomCode: string | null,
  memberId: string | null,
  handlers: Handlers
) {
  const [activeVote, setActiveVote] = useState<ActiveVote | null>(null);
  const [endedVote, setEndedVote] = useState<EndedVote | null>(null);
  const [defensePhase, setDefensePhase] = useState<DefensePhase | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const prevActiveId = useRef<string | null>(null);
  const prevDefenseId = useRef<string | null>(null);
  const prevVotesYes = useRef(0);
  const prevVotesNo = useRef(0);
  const shownEndedIds = useRef<Set<string>>(new Set());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomCode || !memberId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}/active-vote?memberId=${encodeURIComponent(memberId!)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data: PollResponse = await res.json();
        if (cancelled) return;

        // ---- Handle defense phase ----
        if (data.defensePhase) {
          const dp = data.defensePhase;
          if (prevDefenseId.current !== dp.incidentId) {
            // New defense phase
            if (dp.isAccused) {
              handlersRef.current.onDefensePhase?.(dp);
            }
            prevDefenseId.current = dp.incidentId;
          }
          setDefensePhase(dp);
          setActiveVote(null);
          setEndedVote(null);
          return;
        }

        // Defense expired (accused didn't respond in time)
        if (data.defenseExpired && data.accusedName) {
          prevDefenseId.current = null;
          setDefensePhase(null);
          setActiveVote(null);
          handlersRef.current.onDefenseExpired?.(data.accusedName);
          return;
        }

        // No defense phase
        if (prevDefenseId.current) {
          prevDefenseId.current = null;
          setDefensePhase(null);
        }

        // ---- Handle active vote ----
        if (data.activeVote) {
          const av = data.activeVote;
          const isNewVote = prevActiveId.current !== av.incidentId;

          if (isNewVote) {
            if (av.isAccused) {
              handlersRef.current.onAccused?.(av);
            } else {
              handlersRef.current.onVoteStarted?.(av);
            }
            prevVotesYes.current = av.votesYes;
            prevVotesNo.current = av.votesNo;
          } else {
            if (av.votesYes > prevVotesYes.current) {
              handlersRef.current.onVoteUpdate?.(av.votesYes, av.votesNo, "kela");
            }
            if (av.votesNo > prevVotesNo.current) {
              handlersRef.current.onVoteUpdate?.(av.votesYes, av.votesNo, "saeb");
            }
            prevVotesYes.current = av.votesYes;
            prevVotesNo.current = av.votesNo;
          }

          prevActiveId.current = av.incidentId;
          setActiveVote(av);
          setEndedVote(null);
        } else {
          if (prevActiveId.current) {
            prevActiveId.current = null;
            prevVotesYes.current = 0;
            prevVotesNo.current = 0;
          }
          setActiveVote(null);

          if (data.endedVote && !shownEndedIds.current.has(data.endedVote.incidentId)) {
            shownEndedIds.current.add(data.endedVote.incidentId);
            setEndedVote(data.endedVote);
            handlersRef.current.onVoteEnded?.(data.endedVote);
          }
        }
      } catch {
        // network error
      }

      if (!cancelled) {
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [roomCode, memberId]);

  const startVote = useCallback(
    async (payload: {
      accusedId: string;
      accusedName: string;
      reason?: string | null;
    }): Promise<{ ok?: boolean; error?: string }> => {
      if (!roomCode || !memberId) return { error: "Not in a room" };
      try {
        const res = await fetch(`/api/rooms/${roomCode}/votes/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accusedId: payload.accusedId,
            accusedById: memberId,
            reason: payload.reason || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.error || "Failed to start vote." };
        return { ok: true };
      } catch (e: any) {
        return { error: e?.message || "Network error." };
      }
    },
    [roomCode, memberId]
  );

  const castVote = useCallback(
    async (incidentId: string, choice: "kela" | "saeb"): Promise<{ ok?: boolean; error?: string }> => {
      if (!roomCode || !memberId) return { error: "Not in a room" };
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}/votes/${incidentId}/cast`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voterId: memberId, choice }),
          }
        );
        const data = await res.json();
        if (!res.ok) return { error: data?.error || "Failed to cast vote." };
        return { ok: true };
      } catch (e: any) {
        return { error: e?.message || "Network error." };
      }
    },
    [roomCode, memberId]
  );

  const submitDefense = useCallback(
    async (incidentId: string, defense: string): Promise<{ ok?: boolean; error?: string }> => {
      if (!roomCode || !memberId) return { error: "Not in a room" };
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}/incidents/${incidentId}/defend`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId, defense }),
          }
        );
        const data = await res.json();
        if (!res.ok) return { error: data?.error || "Failed to submit defense." };
        return { ok: true };
      } catch (e: any) {
        return { error: e?.message || "Network error." };
      }
    },
    [roomCode, memberId]
  );

  const dismissEndedVote = useCallback(() => {
    setEndedVote(null);
  }, []);

  return {
    activeVote,
    endedVote,
    defensePhase,
    startVote,
    castVote,
    submitDefense,
    dismissEndedVote,
  };
}

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
  voteEndsAt?: number | null;
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
  verdict: "kela" | "saeb" | "tie" | "cancelled";
  isAccusedMe: boolean;
};

type PollResponse = {
  // New multi-vote arrays
  activeVotes?: ActiveVote[];
  endedVotes?: EndedVote[];
  // Backwards-compat single-vote fields
  activeVote?: ActiveVote | null;
  endedVote?: EndedVote | null;
};

type Handlers = {
  onVoteStarted?: (v: ActiveVote) => void;
  onAccused?: (v: ActiveVote) => void;
  onVoteUpdate?: (votesYes: number, votesNo: number, lastChoice: "kela" | "saeb") => void;
  onVoteEnded?: (v: EndedVote) => void;
  onDefenseUpdated?: (defense: string) => void;
};

const POLL_INTERVAL_MS = 700;

export function usePolling(
  roomCode: string | null,
  memberId: string | null,
  handlers: Handlers
) {
  // Multi-vote state (new)
  const [activeVotes, setActiveVotes] = useState<ActiveVote[]>([]);
  const [endedVotes, setEndedVotes] = useState<EndedVote[]>([]);

  // Backwards-compat single-vote state (derived from arrays)
  // activeVote = the first active vote where I'm NOT the accused, OR null
  // (kept so existing VoteModal usage doesn't break)
  const activeVote = activeVotes.find((v) => !v.isAccused) || activeVotes[0] || null;

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Per-vote tracking (keyed by incidentId) for diff detection
  const prevActiveIds = useRef<Set<string>>(new Set());
  const prevVotesByIncident = useRef<Map<string, { yes: number; no: number; defense: string | null }>>(new Map());
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

        const newActiveVotes = data.activeVotes || [];
        const newEndedVotes = data.endedVotes || [];

        // ---- Detect NEW active votes (fire onVoteStarted / onAccused) ----
        for (const av of newActiveVotes) {
          if (!prevActiveIds.current.has(av.incidentId)) {
            // New vote — fire appropriate handler
            if (av.isAccused) {
              handlersRef.current.onAccused?.(av);
            } else {
              handlersRef.current.onVoteStarted?.(av);
            }
            prevVotesByIncident.current.set(av.incidentId, {
              yes: av.votesYes,
              no: av.votesNo,
              defense: av.defense,
            });
          } else {
            // Existing vote — check for tally changes
            const prev = prevVotesByIncident.current.get(av.incidentId);
            if (prev) {
              if (av.votesYes > prev.yes) {
                handlersRef.current.onVoteUpdate?.(av.votesYes, av.votesNo, "kela");
              }
              if (av.votesNo > prev.no) {
                handlersRef.current.onVoteUpdate?.(av.votesYes, av.votesNo, "saeb");
              }
              if (av.defense !== prev.defense && av.defense) {
                handlersRef.current.onDefenseUpdated?.(av.defense);
              }
            }
            prevVotesByIncident.current.set(av.incidentId, {
              yes: av.votesYes,
              no: av.votesNo,
              defense: av.defense,
            });
          }
        }

        // ---- Detect ENDED votes (previously active, now gone) ----
        const newActiveIds = new Set(newActiveVotes.map((v) => v.incidentId));
        for (const prevId of prevActiveIds.current) {
          if (!newActiveIds.has(prevId)) {
            // This vote was active before but is gone now — it ended.
            // Clean up tracking.
            prevVotesByIncident.current.delete(prevId);
          }
        }

        // ---- Fire onVoteEnded for each newly-ended vote ----
        for (const ev of newEndedVotes) {
          if (!shownEndedIds.current.has(ev.incidentId)) {
            shownEndedIds.current.add(ev.incidentId);
            handlersRef.current.onVoteEnded?.(ev);
          }
        }

        // ---- Update state ----
        prevActiveIds.current = newActiveIds;
        setActiveVotes(newActiveVotes);
        setEndedVotes(newEndedVotes);
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
    async (incidentId: string, choice: "kela" | "saeb"): Promise<{ ok?: boolean; error?: string; autoClosed?: boolean; verdict?: "kela" | "saeb" | "tie" | null }> => {
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
        return { ok: true, autoClosed: data.autoClosed, verdict: data.verdict };
      } catch (e: any) {
        return { error: e?.message || "Network error." };
      }
    },
    [roomCode, memberId]
  );

  // Submit defense DURING voting (optional)
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

  // For backwards compat — dismiss the first ended vote
  const dismissEndedVote = useCallback(() => {
    setEndedVotes((prev) => prev.slice(1));
  }, []);

  return {
    // New multi-vote API
    activeVotes,
    endedVotes,
    // Backwards-compat single-vote API
    activeVote,
    endedVote: endedVotes[0] || null,
    startVote,
    castVote,
    submitDefense,
    dismissEndedVote,
  };
}

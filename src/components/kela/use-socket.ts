"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type VoteStartedPayload = {
  incidentId: string;
  accusedId: string;
  accusedName: string;
  accusedById: string;
  accusedByName: string;
  reason: string | null;
  startedAt: number;
  endsAt: number;
};

export type AccusedPayload = {
  incidentId: string;
  accusedByName: string;
  reason: string | null;
  startedAt: number;
  endsAt: number;
};

export type VoteUpdatePayload = {
  incidentId: string;
  votesYes: number;
  votesNo: number;
  voterCount: number;
};

export type VoteEndedPayload = {
  incidentId: string;
  accusedId: string;
  accusedName: string;
  accusedByName: string;
  reason: string | null;
  votesYes: number;
  votesNo: number;
  verdict: "kela" | "saeb" | "tie";
  endReason: "timeout" | "all-voted" | "manual";
};

type Handlers = {
  onVoteStarted?: (p: VoteStartedPayload) => void;
  onAccused?: (p: AccusedPayload) => void;
  onVoteUpdate?: (p: VoteUpdatePayload) => void;
  onVoteEnded?: (p: VoteEndedPayload) => void;
  onOnlineCount?: (n: number) => void;
};

export function useSocket(userId: string | null, userName: string | null, handlers: Handlers) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  // Keep latest handlers without re-creating socket (update in effect to comply with React rules)
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!userId || !userName) return;

    const s = io("/?XTransformPort=3003", {
      path: "/",
      transports: ["polling", "websocket"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      s.emit("identify", { userId, userName });
    });
    s.on("disconnect", () => setConnected(false));

    s.on("vote-started", (p: VoteStartedPayload) => handlersRef.current.onVoteStarted?.(p));
    s.on("accused", (p: AccusedPayload) => handlersRef.current.onAccused?.(p));
    s.on("vote-update", (p: VoteUpdatePayload) => handlersRef.current.onVoteUpdate?.(p));
    s.on("vote-ended", (p: VoteEndedPayload) => handlersRef.current.onVoteEnded?.(p));
    s.on("online-count", (p: { count: number }) => handlersRef.current.onOnlineCount?.(p.count));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [userId, userName]);

  const startVote = (payload: {
    accusedId: string;
    accusedName: string;
    reason?: string | null;
  }): Promise<{ ok?: boolean; incidentId?: string; endsAt?: number; error?: string } | null> => {
    const s = socketRef.current;
    if (!s) return Promise.resolve(null);
    return new Promise((resolve) => {
      s.emit("start-vote", payload, (ack: any) => resolve(ack));
    });
  };

  const castVote = (payload: {
    incidentId: string;
    choice: "kela" | "saeb";
  }): Promise<{ ok?: boolean; error?: string } | null> => {
    const s = socketRef.current;
    if (!s) return Promise.resolve(null);
    return new Promise((resolve) => {
      s.emit("cast-vote", payload, (ack: any) => resolve(ack));
    });
  };

  return { connected, startVote, castVote };
}

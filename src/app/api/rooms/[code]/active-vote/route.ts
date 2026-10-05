import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VOTE_DURATION_MS = 30_000;

// GET /api/rooms/[code]/active-vote?memberId=xxx
// Returns the current active vote (if any) + the most recently ended vote.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // 1. Check for a pending (active) incident
    const pending = await db.kelaIncident.findFirst({
      where: { roomId: room.id, verdict: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, ratePerKela: true } },
        accusedBy: { select: { id: true, name: true } },
        votes: { include: { voter: { select: { id: true, name: true } } } },
      },
    });

    if (pending) {
      const now = Date.now();
      const startedAt = pending.createdAt.getTime();
      const endsAt = startedAt + VOTE_DURATION_MS;

      // Count eligible voters (all members except the accused)
      const totalMembers = await db.roomMember.count({ where: { roomId: room.id } });
      const eligibleVoters = Math.max(0, totalMembers - 1);
      const votedCount = pending.votes.length;

      const timedOut = now >= endsAt;
      const allVoted = eligibleVoters > 0 && votedCount >= eligibleVoters;

      // Finalize if needed
      if (timedOut || allVoted) {
        let verdict: "kela" | "saeb" | "tie";
        if (pending.votesYes > pending.votesNo) verdict = "kela";
        else if (pending.votesNo > pending.votesYes) verdict = "saeb";
        else verdict = "tie";

        await db.kelaIncident.update({
          where: { id: pending.id },
          data: { verdict },
        });

        return NextResponse.json({
          activeVote: null,
          endedVote: {
            incidentId: pending.id,
            accusedId: pending.userId,
            accusedName: pending.user.name,
            accusedById: pending.accusedById,
            accusedByName: pending.accusedBy.name,
            reason: pending.reason,
            votesYes: pending.votesYes,
            votesNo: pending.votesNo,
            verdict,
            isAccusedMe: pending.userId === memberId,
          },
        });
      }

      // Still active — return current state
      const myVote = memberId
        ? pending.votes.find((v) => v.voterId === memberId)?.choice || null
        : null;

      return NextResponse.json({
        activeVote: {
          incidentId: pending.id,
          accusedId: pending.userId,
          accusedName: pending.user.name,
          accusedById: pending.accusedById,
          accusedByName: pending.accusedBy.name,
          reason: pending.reason,
          startedAt,
          endsAt,
          votesYes: pending.votesYes,
          votesNo: pending.votesNo,
          voterCount: pending.votes.length,
          myVote,
          isAccused: pending.userId === memberId,
        },
        endedVote: null,
      });
    }

    // 2. No pending incident — check for a recently ended one (within last 15 seconds)
    const recentEnded = await db.kelaIncident.findFirst({
      where: {
        roomId: room.id,
        verdict: { not: "pending" },
        createdAt: { gt: new Date(Date.now() - 15_000) },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        accusedBy: { select: { id: true, name: true } },
      },
    });

    if (recentEnded) {
      return NextResponse.json({
        activeVote: null,
        endedVote: {
          incidentId: recentEnded.id,
          accusedId: recentEnded.userId,
          accusedName: recentEnded.user.name,
          accusedById: recentEnded.accusedById,
          accusedByName: recentEnded.accusedBy.name,
          reason: recentEnded.reason,
          votesYes: recentEnded.votesYes,
          votesNo: recentEnded.votesNo,
          verdict: recentEnded.verdict as "kela" | "saeb" | "tie",
          isAccusedMe: recentEnded.userId === memberId,
        },
      });
    }

    // 3. Nothing happening
    return NextResponse.json({ activeVote: null, endedVote: null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

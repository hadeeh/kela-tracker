import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VOTE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// GET /api/rooms/[code]/active-vote?memberId=xxx
//
// Returns ALL active (in-progress) votes in the room + any votes that ended
// in the last 15 seconds (so clients can show a result modal per vote).
//
// Multiple simultaneous votes are supported — the response is an array.
//
// Auto-closes any votes whose 5-minute deadline has passed. The verdict is
// decided by current vote counts:
//   votesYes > votesNo → "kela"
//   votesNo > votesYes → "saeb"
//   tie or zero votes  → "tie" (no fine, no verdict recorded as guilty)
//
// Response shape:
// {
//   activeVotes: ActiveVote[],   // all currently-open votes
//   endedVotes:  EndedVote[],    // votes that ended in last 15s (for result modals)
// }
//
// For backwards compat, also returns:
// {
//   activeVote: ActiveVote | null,  // = activeVotes[0] or null
//   endedVote:  EndedVote | null,   // = endedVotes[0] or null
// }
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const now = new Date();

    // ---- 1. Auto-close any expired votes ----
    // Find all "voting" incidents whose voteEndsAt has passed.
    const expired = await db.kelaIncident.findMany({
      where: {
        roomId: room.id,
        status: "voting",
        voteEndsAt: { lt: now },
      },
      include: {
        user: { select: { id: true, name: true } },
        accusedBy: { select: { id: true, name: true } },
      },
    });

    for (const inc of expired) {
      let verdict: "kela" | "saeb" | "tie";
      if (inc.votesYes > inc.votesNo) verdict = "kela";
      else if (inc.votesNo > inc.votesYes) verdict = "saeb";
      else verdict = "tie"; // tie or zero votes → tie (no fine)

      await db.kelaIncident.update({
        where: { id: inc.id },
        data: { verdict, status: "completed" },
      });
    }

    // ---- 2. Fetch all currently-active votes ----
    const activeIncidents = await db.kelaIncident.findMany({
      where: { roomId: room.id, status: "voting" },
      orderBy: { createdAt: "asc" }, // oldest first
      include: {
        user: { select: { id: true, name: true, email: true, ratePerKela: true } },
        accusedBy: { select: { id: true, name: true } },
        votes: { include: { voter: { select: { id: true, name: true } } } },
      },
    });

    // Also auto-close any vote where all eligible voters have voted.
    // (Belt + suspenders alongside the cast-route auto-close.)
    const totalApproved = await db.roomMember.count({
      where: { roomId: room.id, status: "approved" },
    });
    const eligibleVoters = Math.max(0, totalApproved - 1);

    const activeVotes: any[] = [];
    const justClosedByAllVoted: any[] = [];

    for (const pending of activeIncidents) {
      // Skip if already auto-closed above by deadline
      if (expired.some((e) => e.id === pending.id)) continue;

      const actualVoteCount = await db.vote.count({ where: { incidentId: pending.id } });
      const allVoted = eligibleVoters > 0 && actualVoteCount >= eligibleVoters;

      if (allVoted) {
        // Auto-close on full participation
        let verdict: "kela" | "saeb" | "tie";
        if (pending.votesYes > pending.votesNo) verdict = "kela";
        else if (pending.votesNo > pending.votesYes) verdict = "saeb";
        else verdict = "tie";

        await db.kelaIncident.update({
          where: { id: pending.id },
          data: { verdict, status: "completed" },
        });

        justClosedByAllVoted.push({
          incidentId: pending.id,
          accusedId: pending.userId,
          accusedName: pending.user.name,
          accusedById: pending.accusedById,
          accusedByName: pending.accusedBy.name,
          reason: pending.reason,
          defense: pending.defense,
          votesYes: pending.votesYes,
          votesNo: pending.votesNo,
          verdict,
          isAccusedMe: pending.userId === memberId,
        });
      } else {
        // Still active
        const myVote = memberId
          ? pending.votes.find((v) => v.voterId === memberId)?.choice || null
          : null;
        const startedAt = pending.createdAt.getTime();
        const endsAt = pending.voteEndsAt ? pending.voteEndsAt.getTime() : (startedAt + VOTE_DURATION_MS);

        activeVotes.push({
          incidentId: pending.id,
          accusedId: pending.userId,
          accusedName: pending.user.name,
          accusedById: pending.accusedById,
          accusedByName: pending.accusedBy.name,
          reason: pending.reason,
          defense: pending.defense,
          startedAt,
          endsAt,
          voteEndsAt: pending.voteEndsAt?.getTime() ?? null,
          votesYes: pending.votesYes,
          votesNo: pending.votesNo,
          voterCount: pending.votes.length,
          myVote,
          isAccused: pending.userId === memberId,
        });
      }
    }

    // ---- 3. Fetch recently-ended votes (last 15s) for result modals ----
    // Includes both deadline-expired (from step 1) and all-voted (from step 2).
    const recentEnded = await db.kelaIncident.findMany({
      where: {
        roomId: room.id,
        status: { in: ["completed", "cancelled"] },
        verdict: { in: ["kela", "saeb", "tie", "cancelled"] },
        createdAt: { gt: new Date(Date.now() - 15_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, name: true } },
        accusedBy: { select: { id: true, name: true } },
      },
    });

    const endedVotes = recentEnded.map((inc) => ({
      incidentId: inc.id,
      accusedId: inc.userId,
      accusedName: inc.user.name,
      accusedById: inc.accusedById,
      accusedByName: inc.accusedBy.name,
      reason: inc.reason,
      defense: inc.defense,
      votesYes: inc.votesYes,
      votesNo: inc.votesNo,
      verdict: inc.verdict as "kela" | "saeb" | "tie" | "cancelled",
      isAccusedMe: inc.userId === memberId,
    }));

    return NextResponse.json({
      // New multi-vote arrays
      activeVotes,
      endedVotes,
      // Backwards-compat single-vote fields (first of each)
      activeVote: activeVotes[0] || null,
      endedVote: endedVotes[0] || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

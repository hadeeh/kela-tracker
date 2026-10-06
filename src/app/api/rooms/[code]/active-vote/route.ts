import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VOTE_DURATION_MS = 30_000;
const DEFENSE_DEADLINE_MS = 30_000;

// GET /api/rooms/[code]/active-vote?memberId=xxx
// Returns the current active incident (awaiting defense OR voting) + recently ended.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // 1. Check for an active incident (awaiting defense OR voting)
    const active = await db.kelaIncident.findFirst({
      where: {
        roomId: room.id,
        status: { in: ["awaiting_defense", "voting"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, ratePerKela: true } },
        accusedBy: { select: { id: true, name: true } },
        votes: { include: { voter: { select: { id: true, name: true } } } },
      },
    });

    if (active) {
      const now = Date.now();

      // --- AWAITING DEFENSE phase ---
      if (active.status === "awaiting_defense") {
        const deadline = active.defenseDeadline ? active.defenseDeadline.getTime() : active.createdAt.getTime() + DEFENSE_DEADLINE_MS;
        const timeLeft = Math.max(0, deadline - now);

        // Check if deadline passed
        if (timeLeft <= 0) {
          // Cancel the incident
          await db.kelaIncident.update({
            where: { id: active.id },
            data: { status: "cancelled", verdict: "cancelled" },
          });

          return NextResponse.json({
            activeVote: null,
            endedVote: null,
            defenseExpired: true,
            accusedName: active.user.name,
          });
        }

        return NextResponse.json({
          activeVote: null,
          endedVote: null,
          defensePhase: {
            incidentId: active.id,
            accusedId: active.userId,
            accusedName: active.user.name,
            accusedById: active.accusedById,
            accusedByName: active.accusedBy.name,
            reason: active.reason,
            defenseDeadline: deadline,
            timeLeft,
            isAccused: active.userId === memberId,
          },
        });
      }

      // --- VOTING phase ---
      if (active.status === "voting") {
        const startedAt = active.createdAt.getTime();
        const endsAt = startedAt + VOTE_DURATION_MS;

        const totalMembers = await db.roomMember.count({
          where: { roomId: room.id, status: "approved" },
        });
        const eligibleVoters = Math.max(0, totalMembers - 1);
        const votedCount = active.votes.length;

        const timedOut = now >= endsAt;
        const allVoted = eligibleVoters > 0 && votedCount >= eligibleVoters;

        // Finalize if needed
        if (timedOut || allVoted) {
          let verdict: "kela" | "saeb" | "tie";
          if (active.votesYes > active.votesNo) verdict = "kela";
          else if (active.votesNo > active.votesYes) verdict = "saeb";
          else verdict = "tie";

          await db.kelaIncident.update({
            where: { id: active.id },
            data: { verdict, status: "completed" },
          });

          return NextResponse.json({
            activeVote: null,
            endedVote: {
              incidentId: active.id,
              accusedId: active.userId,
              accusedName: active.user.name,
              accusedById: active.accusedById,
              accusedByName: active.accusedBy.name,
              reason: active.reason,
              defense: active.defense,
              votesYes: active.votesYes,
              votesNo: active.votesNo,
              verdict,
              isAccusedMe: active.userId === memberId,
            },
          });
        }

        // Still voting — return current state
        const myVote = memberId
          ? active.votes.find((v) => v.voterId === memberId)?.choice || null
          : null;

        return NextResponse.json({
          activeVote: {
            incidentId: active.id,
            accusedId: active.userId,
            accusedName: active.user.name,
            accusedById: active.accusedById,
            accusedByName: active.accusedBy.name,
            reason: active.reason,
            defense: active.defense,
            startedAt,
            endsAt,
            votesYes: active.votesYes,
            votesNo: active.votesNo,
            voterCount: active.votes.length,
            myVote,
            isAccused: active.userId === memberId,
          },
          endedVote: null,
          defensePhase: null,
        });
      }
    }

    // 2. No active incident — check for a recently ended one (within last 15 seconds)
    const recentEnded = await db.kelaIncident.findFirst({
      where: {
        roomId: room.id,
        status: "completed",
        verdict: { in: ["kela", "saeb", "tie"] },
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
          defense: recentEnded.defense,
          votesYes: recentEnded.votesYes,
          votesNo: recentEnded.votesNo,
          verdict: recentEnded.verdict as "kela" | "saeb" | "tie",
          isAccusedMe: recentEnded.userId === memberId,
        },
        defensePhase: null,
      });
    }

    // 3. Nothing happening
    return NextResponse.json({
      activeVote: null,
      endedVote: null,
      defensePhase: null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

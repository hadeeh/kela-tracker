import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/votes/[incidentId]/cast
// Body: { voterId, choice }
// Records a vote, updates counts, and AUTO-CLOSES the vote if all eligible
// voters have voted (so the minister doesn't have to force-settle).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string; incidentId: string }> }
) {
  try {
    const { code, incidentId } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const { voterId, choice } = body as { voterId: string; choice: "kela" | "saeb" };

    if (!voterId || (choice !== "kela" && choice !== "saeb")) {
      return NextResponse.json({ error: "voterId and choice (kela|saeb) are required." }, { status: 400 });
    }

    const incident = await db.kelaIncident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    if (incident.roomId !== room.id) return NextResponse.json({ error: "Wrong room." }, { status: 400 });
    if (incident.verdict !== "pending") {
      return NextResponse.json({ error: "Voting already closed." }, { status: 400 });
    }
    if (incident.userId === voterId) {
      return NextResponse.json({ error: "Accused cannot vote." }, { status: 400 });
    }

    // Create the vote (unique constraint prevents double-voting)
    try {
      await db.vote.create({ data: { incidentId, voterId, choice } });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json({ error: "Already voted." }, { status: 409 });
      }
      throw e;
    }

    // Update denormalized counts
    const updated = await db.kelaIncident.update({
      where: { id: incidentId },
      data: {
        votesYes: { increment: choice === "kela" ? 1 : 0 },
        votesNo: { increment: choice === "saeb" ? 1 : 0 },
      },
      select: { votesYes: true, votesNo: true, status: true, verdict: true },
    });

    // ---- AUTO-CLOSE: check if all eligible voters have voted OR deadline passed ----
    // Count approved members (excluding the accused)
    const totalApproved = await db.roomMember.count({
      where: { roomId: room.id, status: "approved" },
    });
    const eligibleVoters = Math.max(0, totalApproved - 1);

    // Count actual Vote rows for this incident (most reliable source)
    const actualVoteCount = await db.vote.count({ where: { incidentId } });

    // Re-fetch the incident to get the latest voteEndsAt
    const refreshed = await db.kelaIncident.findUnique({
      where: { id: incidentId },
      select: { status: true, voteEndsAt: true, votesYes: true, votesNo: true },
    });

    let autoClosed = false;
    let verdict: "kela" | "saeb" | "tie" | null = null;

    if (refreshed && refreshed.status === "voting") {
      const allVoted = eligibleVoters > 0 && actualVoteCount >= eligibleVoters;
      const deadlinePassed = !!(refreshed.voteEndsAt && refreshed.voteEndsAt.getTime() < Date.now());

      if (allVoted || deadlinePassed) {
        if (refreshed.votesYes > refreshed.votesNo) verdict = "kela";
        else if (refreshed.votesNo > refreshed.votesYes) verdict = "saeb";
        else verdict = "tie";

        await db.kelaIncident.update({
          where: { id: incidentId },
          data: { verdict, status: "completed" },
        });
        autoClosed = true;
      }
    }

    return NextResponse.json({
      ok: true,
      votesYes: updated.votesYes,
      votesNo: updated.votesNo,
      autoClosed,
      verdict,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

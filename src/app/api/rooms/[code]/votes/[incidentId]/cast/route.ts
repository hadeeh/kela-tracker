import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/votes/[incidentId]/cast
// Body: { voterId, choice }
// Records a vote and returns updated counts.
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

    // Update counts
    const updated = await db.kelaIncident.update({
      where: { id: incidentId },
      data: {
        votesYes: { increment: choice === "kela" ? 1 : 0 },
        votesNo: { increment: choice === "saeb" ? 1 : 0 },
      },
      select: { votesYes: true, votesNo: true },
    });

    return NextResponse.json({
      ok: true,
      votesYes: updated.votesYes,
      votesNo: updated.votesNo,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

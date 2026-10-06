import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VOTE_DURATION_MS = 30_000;

// POST /api/rooms/[code]/incidents/[incidentId]/defend
// The accused submits their "last words" defense.
// This transitions the incident from "awaiting_defense" to "voting".
// Body: { memberId, defense }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string; incidentId: string }> }
) {
  try {
    const { code, incidentId } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const memberId = (body?.memberId ?? "").toString();
    const defense = (body?.defense ?? "").toString().trim().slice(0, 200);

    if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    if (!defense) return NextResponse.json({ error: "Defense cannot be empty." }, { status: 400 });

    const incident = await db.kelaIncident.findUnique({ where: { id: incidentId } });
    if (!incident) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    if (incident.roomId !== room.id) return NextResponse.json({ error: "Wrong room." }, { status: 400 });

    // Verify the submitter is the accused
    if (incident.userId !== memberId) {
      return NextResponse.json({ error: "Only the accused can submit a defense." }, { status: 403 });
    }

    // Check if still in defense phase
    if (incident.status !== "awaiting_defense") {
      return NextResponse.json({ error: "Defense phase has ended." }, { status: 400 });
    }

    // Check deadline
    if (incident.defenseDeadline && Date.now() > incident.defenseDeadline.getTime()) {
      // Deadline passed — cancel the incident
      await db.kelaIncident.update({
        where: { id: incidentId },
        data: { status: "cancelled", verdict: "cancelled" },
      });
      return NextResponse.json({ error: "Defense deadline passed. Vote cancelled." }, { status: 400 });
    }

    // Submit defense + start voting
    const now = new Date();
    const endsAt = new Date(now.getTime() + VOTE_DURATION_MS);

    await db.kelaIncident.update({
      where: { id: incidentId },
      data: {
        defense,
        status: "voting",
        // Update createdAt to now so the vote timer starts fresh
        createdAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      defense,
      voteEndsAt: endsAt.getTime(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

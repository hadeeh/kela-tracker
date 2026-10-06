import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/incidents/[incidentId]/defend
// The accused submits their "last words" defense DURING the voting period.
// This does NOT start or stop the vote — it just adds the defense text.
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

    // Must be during voting phase
    if (incident.status !== "voting") {
      return NextResponse.json({ error: "Voting is not active." }, { status: 400 });
    }

    // Update the defense (can be submitted at any time during voting)
    await db.kelaIncident.update({
      where: { id: incidentId },
      data: { defense },
    });

    return NextResponse.json({
      ok: true,
      defense,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

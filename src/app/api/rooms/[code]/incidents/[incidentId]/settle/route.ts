import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/incidents/[incidentId]/settle
// Toggles the settled status of an incident (minister only).
// Body: { memberId } — the minister's member ID
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

    if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });

    // Verify the requester is a minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (member.role !== "minister") {
      return NextResponse.json({ error: "Only the Kela Minister can settle/delete fines." }, { status: 403 });
    }

    // Find the incident
    const incident = await db.kelaIncident.findUnique({ where: { id: incidentId } });
    if (!incident) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    if (incident.roomId !== room.id) return NextResponse.json({ error: "Wrong room." }, { status: 400 });
    if (incident.verdict === "pending") {
      return NextResponse.json({ error: "Cannot settle a pending vote." }, { status: 400 });
    }

    // Toggle settled status
    const updated = await db.kelaIncident.update({
      where: { id: incidentId },
      data: {
        settled: !incident.settled,
        settledAt: !incident.settled ? new Date() : null,
      },
      select: { id: true, settled: true, settledAt: true },
    });

    return NextResponse.json({
      ok: true,
      settled: updated.settled,
      settledAt: updated.settledAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

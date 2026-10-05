import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/rooms/[code]/incidents/[incidentId]
// Deletes an incident (minister only). Also cascades to delete its votes.
// Body: { memberId } — the minister's member ID
export async function DELETE(
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

    // Verify the requester is a minister (or room host)
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can delete incidents." }, { status: 403 });
    }

    // Find the incident
    const incident = await db.kelaIncident.findUnique({ where: { id: incidentId } });
    if (!incident) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    if (incident.roomId !== room.id) return NextResponse.json({ error: "Wrong room." }, { status: 400 });

    // Delete the incident (cascades to votes)
    await db.kelaIncident.delete({ where: { id: incidentId } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

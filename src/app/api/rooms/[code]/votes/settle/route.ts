import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/votes/settle
// Minister can force-end an active vote (settle/cancel).
// Body: { memberId, action, incidentId? } — action: "kela" | "saeb" | "tie" | "cancel"
//
// If incidentId is provided, settles THAT specific vote (since multiple votes
// can be active simultaneously). If not provided, settles the most recent
// active vote (backwards-compat).
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const memberId = (body?.memberId ?? "").toString();
    const action = (body?.action ?? "").toString();
    const incidentId = (body?.incidentId ?? "").toString() || null;

    if (!memberId || !action) {
      return NextResponse.json({ error: "memberId and action are required." }, { status: 400 });
    }
    if (!["kela", "saeb", "tie", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Use: kela, saeb, tie, or cancel." }, { status: 400 });
    }

    // Verify minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can settle votes." }, { status: 403 });
    }

    // Find the target active vote: by incidentId if provided, else most recent
    let active;
    if (incidentId) {
      active = await db.kelaIncident.findFirst({
        where: { id: incidentId, roomId: room.id, status: "voting" },
      });
    } else {
      active = await db.kelaIncident.findFirst({
        where: { roomId: room.id, status: "voting" },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!active) {
      return NextResponse.json({ error: "No active vote to settle." }, { status: 400 });
    }

    if (action === "cancel") {
      // Cancel the vote — no verdict, no fine
      await db.kelaIncident.update({
        where: { id: active.id },
        data: { status: "cancelled", verdict: "cancelled" },
      });
      return NextResponse.json({ ok: true, action: "cancelled", incidentId: active.id });
    }

    // Force a verdict (kela, saeb, or tie)
    await db.kelaIncident.update({
      where: { id: active.id },
      data: { status: "completed", verdict: action },
    });

    return NextResponse.json({ ok: true, action, incidentId: active.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

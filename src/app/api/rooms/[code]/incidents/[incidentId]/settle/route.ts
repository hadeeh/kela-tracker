import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/incidents/[incidentId]/settle
// Records a payment for an incident (minister only).
// Body: { memberId, paidAmount } — the amount paid in PKR (adds to existing paidAmount)
// If paidAmount is 0, resets the payment to 0 (reopens the fine).
// If paidAmount is -1, sets paidAmount to the full rate (fully settled).
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
    const paidAmount = Number(body?.paidAmount);

    if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    if (Number.isNaN(paidAmount) || paidAmount < -1) {
      return NextResponse.json({ error: "Invalid paidAmount." }, { status: 400 });
    }

    // Verify the requester is a minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (member.role !== "minister") {
      return NextResponse.json({ error: "Only the Kela Minister can settle payments." }, { status: 403 });
    }

    // Find the incident with the accused member's rate
    const incident = await db.kelaIncident.findUnique({
      where: { id: incidentId },
      include: { user: { select: { ratePerKela: true } } },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    if (incident.roomId !== room.id) return NextResponse.json({ error: "Wrong room." }, { status: 400 });
    if (incident.verdict === "pending") {
      return NextResponse.json({ error: "Cannot settle a pending vote." }, { status: 400 });
    }

    const rate = incident.user.ratePerKela;

    // Determine the new paidAmount
    let newPaidAmount: number;
    let settledAt: Date | null;

    if (paidAmount === -1) {
      // Full settlement
      newPaidAmount = rate;
      settledAt = new Date();
    } else if (paidAmount === 0) {
      // Reset (reopen)
      newPaidAmount = 0;
      settledAt = null;
    } else {
      // Partial payment — add to existing
      newPaidAmount = incident.paidAmount + Math.round(paidAmount);
      // Cap at the rate
      if (newPaidAmount > rate) newPaidAmount = rate;
      // Mark settled if fully paid
      settledAt = newPaidAmount >= rate ? new Date() : incident.settledAt;
    }

    const updated = await db.kelaIncident.update({
      where: { id: incidentId },
      data: {
        paidAmount: newPaidAmount,
        settledAt,
      },
      select: { id: true, paidAmount: true, settledAt: true },
    });

    const remaining = Math.max(0, rate - newPaidAmount);

    return NextResponse.json({
      ok: true,
      paidAmount: updated.paidAmount,
      settledAt: updated.settledAt,
      rate,
      remaining,
      fullySettled: newPaidAmount >= rate,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

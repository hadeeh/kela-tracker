import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/rate — update rate per kela
// The Kela Minister can update ANY member's rate.
// Non-ministers can only update their OWN rate.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const memberId = (body?.memberId ?? "").toString();
    const targetMemberId = (body?.targetMemberId ?? "").toString(); // optional: for minister to set others
    const rate = Number(body?.ratePerKela);

    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    if (Number.isNaN(rate) || rate < 0 || rate > 100000) {
      return NextResponse.json({ error: "Rate must be between 0 and 100000." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Verify the requester is a member
    const requester = await db.roomMember.findFirst({
      where: { id: memberId, roomId: room.id },
    });
    if (!requester) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Determine whose rate to update
    const targetId = targetMemberId || memberId;

    // If updating someone else, must be a minister (or room host)
    if (targetId !== memberId) {
      const isMinister = requester.role === "minister" || requester.email === room.hostEmail;
      if (!isMinister) {
        return NextResponse.json({ error: "Only the Kela Minister can set other members' rates." }, { status: 403 });
      }
    }

    const updated = await db.roomMember.update({
      where: { id: targetId, roomId: room.id },
      data: { ratePerKela: Math.round(rate) },
      select: { id: true, ratePerKela: true, name: true },
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

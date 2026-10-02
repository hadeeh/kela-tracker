import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/rate — update my own rate per kela
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const memberId = (body?.memberId ?? "").toString();
    const rate = Number(body?.ratePerKela);

    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    if (Number.isNaN(rate) || rate < 0 || rate > 100000) {
      return NextResponse.json({ error: "Rate must be between 0 and 100000." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const member = await db.roomMember.update({
      where: { id: memberId, roomId: room.id },
      data: { ratePerKela: Math.round(rate) },
      select: { id: true, ratePerKela: true },
    });

    return NextResponse.json({ ok: true, member });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

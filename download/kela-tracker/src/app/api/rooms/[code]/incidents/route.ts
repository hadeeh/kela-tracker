import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/rooms/[code]/incidents — recent incidents for this room
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() }, select: { id: true } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const incidents = await db.kelaIncident.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true, ratePerKela: true } },
        accusedBy: { select: { id: true, name: true } },
        votes: { include: { voter: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ incidents });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

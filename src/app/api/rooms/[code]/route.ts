import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/rooms/[code] — fetch room + members + recent incidents (public)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        incidents: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            user: { select: { id: true, name: true, email: true, ratePerKela: true } },
            accusedBy: { select: { id: true, name: true } },
            votes: { include: { voter: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        hostEmail: room.hostEmail,
        createdAt: room.createdAt,
      },
      members: room.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ratePerKela: m.ratePerKela,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      incidents: room.incidents,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

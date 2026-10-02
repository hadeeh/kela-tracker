import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/join — join an existing room with name + email (no password)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const name = (body?.name ?? "").toString().trim().slice(0, 40);
    const email = (body?.email ?? "").toString().trim().toLowerCase().slice(0, 120);

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Already a member? Return the existing one.
    const existing = await db.roomMember.findUnique({
      where: { roomId_email: { roomId: room.id, email } },
    });
    if (existing) {
      return NextResponse.json({ room: { id: room.id, code: room.code, name: room.name }, member: existing });
    }

    const member = await db.roomMember.create({
      data: { roomId: room.id, name, email, ratePerKela: 50 },
    });

    return NextResponse.json({ room: { id: room.id, code: room.code, name: room.name }, member });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

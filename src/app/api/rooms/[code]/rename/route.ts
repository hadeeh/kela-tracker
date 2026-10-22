import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/rename
// Minister-only: updates the room's display name.
// Body: { memberId, name }
//
// The room code stays the same — only the display name changes.
// All existing members will see the new name on next poll/refresh.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const memberId = (body?.memberId ?? "").toString();
    const name = (body?.name ?? "").toString().trim();

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Room name cannot be empty." }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json({ error: "Room name must be 60 characters or fewer." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Verify minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can rename the room." }, { status: 403 });
    }

    const updated = await db.room.update({
      where: { id: room.id },
      data: { name },
      select: { id: true, code: true, name: true },
    });

    return NextResponse.json({
      ok: true,
      room: updated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

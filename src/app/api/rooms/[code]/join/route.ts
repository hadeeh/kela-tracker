import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/join — join an existing room with name + email (no password)
// If the email already exists in this room:
//   - If they were pre-invited (placeholder name), update their name + return them
//   - If they already joined before, just return them (no update)
//   - If they were anonymized ("Removed User"), reject with clear message
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

    // Check if email already exists in this room
    const existing = await db.roomMember.findUnique({
      where: { roomId_email: { roomId: room.id, email } },
    });

    if (existing) {
      // Check if this member was anonymized (removed by minister)
      if (existing.name === "Removed User") {
        return NextResponse.json({
          error: "This email was removed from the room by the Kela Minister. Please use a different email or ask the minister to re-invite you.",
        }, { status: 403 });
      }

      // If the existing member has a placeholder name (from email invite), update it
      // with the real name the user is providing now.
      if (existing.name !== name && existing.name === email.split("@")[0]) {
        const updated = await db.roomMember.update({
          where: { id: existing.id },
          data: { name },
        });
        return NextResponse.json({
          room: { id: room.id, code: room.code, name: room.name },
          member: updated,
          alreadyJoined: true,
        });
      }

      // Already joined with this email — just return them
      return NextResponse.json({
        room: { id: room.id, code: room.code, name: room.name },
        member: existing,
        alreadyJoined: true,
      });
    }

    // New member — create
    const member = await db.roomMember.create({
      data: { roomId: room.id, name, email, ratePerKela: 50 },
    });

    return NextResponse.json({
      room: { id: room.id, code: room.code, name: room.name },
      member,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function genCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusing chars
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `KELA-${s}`;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = genCode();
    const existing = await db.room.findUnique({ where: { code: c } });
    if (!existing) return c;
  }
  // Fallback with extra digits
  return genCode() + Math.floor(Math.random() * 90 + 10);
}

// POST /api/rooms — create a new room
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const hostName = (body?.hostName ?? "").toString().trim().slice(0, 40);
    const hostEmail = (body?.hostEmail ?? "").toString().trim().toLowerCase().slice(0, 120);
    const roomName = (body?.roomName ?? "").toString().trim().slice(0, 60) || "Kela Circle";

    if (!hostName || !hostEmail) {
      return NextResponse.json({ error: "Your name and email are required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(hostEmail)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }

    const code = await uniqueCode();
    const room = await db.room.create({
      data: {
        code,
        name: roomName,
        hostEmail,
        members: {
          create: { name: hostName, email: hostEmail, ratePerKela: 50, role: "minister" },
        },
      },
      include: { members: true },
    });

    const hostMember = room.members[0];
    return NextResponse.json({
      room: { id: room.id, code: room.code, name: room.name, createdAt: room.createdAt },
      member: { id: hostMember.id, name: hostMember.name, email: hostMember.email, ratePerKela: hostMember.ratePerKela, role: hostMember.role },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

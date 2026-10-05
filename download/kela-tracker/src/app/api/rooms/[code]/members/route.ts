import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/members — invite a friend by email.
// If they aren't a member yet, this pre-registers them with a placeholder name
// (the email's local part) so they show up in the friend circle immediately.
// When they actually join via the link, their name gets updated.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const email = (body?.email ?? "").toString().trim().toLowerCase().slice(0, 120);
    const name = (body?.name ?? "").toString().trim().slice(0, 40);

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Already invited/joined?
    const existing = await db.roomMember.findUnique({
      where: { roomId_email: { roomId: room.id, email } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, already: true, member: existing });
    }

    const placeholderName = name || email.split("@")[0];
    const member = await db.roomMember.create({
      data: { roomId: room.id, email, name: placeholderName, ratePerKela: 50 },
    });

    return NextResponse.json({ ok: true, member });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

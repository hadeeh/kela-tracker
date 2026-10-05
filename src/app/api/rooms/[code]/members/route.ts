import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/members — invite a friend by email.
// Only the Kela Minister can invite. The minister can choose the invitee's role
// ("minister" or null/non-minister).
// Pre-registers them so they show up in the friend circle immediately.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const email = (body?.email ?? "").toString().trim().toLowerCase().slice(0, 120);
    const name = (body?.name ?? "").toString().trim().slice(0, 40);
    const role = body?.role === "minister" ? "minister" : null;
    const ratePerKela = Number(body?.ratePerKela);
    const inviterId = (body?.inviterId ?? "").toString();

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }
    if (!inviterId) {
      return NextResponse.json({ error: "Inviter ID is required." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Verify inviter is a member AND is a minister
    const inviter = await db.roomMember.findFirst({
      where: { id: inviterId, roomId: room.id },
    });
    if (!inviter) return NextResponse.json({ error: "Inviter not found in room." }, { status: 404 });
    if (inviter.role !== "minister") {
      return NextResponse.json({ error: "Only the Kela Minister can invite members." }, { status: 403 });
    }

    // Already invited/joined?
    const existing = await db.roomMember.findUnique({
      where: { roomId_email: { roomId: room.id, email } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, already: true, member: existing });
    }

    const placeholderName = name || email.split("@")[0];
    const validRate = !Number.isNaN(ratePerKela) && ratePerKela >= 0 && ratePerKela <= 100000
      ? Math.round(ratePerKela)
      : 50;

    const member = await db.roomMember.create({
      data: {
        roomId: room.id,
        email,
        name: placeholderName,
        ratePerKela: validRate,
        role,
      },
    });

    return NextResponse.json({ ok: true, member });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

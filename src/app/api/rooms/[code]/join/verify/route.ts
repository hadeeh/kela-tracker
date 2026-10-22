import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/join/verify
// Body: { name, email, code }
// Verifies the OTP code, then creates or returns the room member.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const name = (body?.name ?? "").toString().trim().slice(0, 40);
    const email = (body?.email ?? "").toString().trim().toLowerCase().slice(0, 120);
    const otp = (body?.code ?? "").toString().trim();

    if (!name || !email || !otp) {
      return NextResponse.json({ error: "Name, email, and verification code are required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Verification code must be 6 digits." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Find the most recent unused code for this email + room
    const verification = await db.emailVerificationCode.findFirst({
      where: { email, roomId: room.id, code: otp, used: false },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    if (verification.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired. Please request a new one." }, { status: 400 });
    }

    // Mark the code as used
    await db.emailVerificationCode.update({
      where: { id: verification.id },
      data: { used: true },
    });

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

    // New member — create with "pending" status (minister must approve)
    const member = await db.roomMember.create({
      data: {
        roomId: room.id,
        name,
        email,
        ratePerKela: 50,
        status: "pending",
      },
    });

    return NextResponse.json({
      room: { id: room.id, code: room.code, name: room.name },
      member,
      pendingApproval: true,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

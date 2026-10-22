import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOTPEmail } from "@/lib/email";

// POST /api/rooms/[code]/join/request-code
// Body: { name, email }
// Generates a 6-digit OTP, stores it (10-min expiry), and emails it to the user.
// Rate-limited: max 1 code per email per 60 seconds.
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

    // Rate limit: check if a code was sent in the last 60 seconds
    const recentCode = await db.emailVerificationCode.findFirst({
      where: {
        email,
        roomId: room.id,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentCode) {
      return NextResponse.json({
        error: "A code was already sent. Please wait 60 seconds before requesting another.",
      }, { status: 429 });
    }

    // Generate 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.emailVerificationCode.create({
      data: { email, roomId: room.id, code: otp, expiresAt },
    });

    // Send the email
    const result = await sendOTPEmail({ to: email, code: otp, roomName: room.name });
    if (!result.ok) {
      return NextResponse.json({
        error: "Could not send verification email. " + (result.error || ""),
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

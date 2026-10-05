import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";

// POST /api/rooms/[code]/members — invite a friend by email.
// Only the Kela Minister can invite. The minister can choose the invitee's role
// ("minister" or null/non-minister).
// Pre-registers them so they show up in the friend circle immediately.
// Also sends an actual email invitation if RESEND_API_KEY is configured.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const email = (body?.email ?? "").toString().trim().toLowerCase().slice(0, 120);
    const name = (body?.name ?? "").toString().trim().slice(0, 40);
    const role = body?.role === "minister" ? "minister" : null;
    const ratePerKela = Number(body?.ratePerKela);
    const inviterId = (body?.inviterId ?? "").toString();
    const sendEmail = body?.sendEmail !== false; // default: send email

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }
    if (!inviterId) {
      return NextResponse.json({ error: "Inviter ID is required." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Verify inviter is a member AND is a minister (or is the room host)
    const inviter = await db.roomMember.findFirst({
      where: { id: inviterId, roomId: room.id },
    });
    if (!inviter) return NextResponse.json({ error: "Inviter not found in room." }, { status: 404 });

    // Treat as minister if: role is "minister" OR they're the room host (hostEmail matches)
    const isMinister = inviter.role === "minister" || inviter.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can invite members." }, { status: 403 });
    }

    // If the host doesn't have the minister role yet, set it
    if (inviter.role !== "minister" && inviter.email === room.hostEmail) {
      await db.roomMember.update({
        where: { id: inviterId },
        data: { role: "minister" },
      });
    }

    // Already invited/joined?
    const existing = await db.roomMember.findUnique({
      where: { roomId_email: { roomId: room.id, email } },
    });
    if (existing) {
      // Check if the existing member was anonymized (removed)
      if (existing.name === "Removed User") {
        return NextResponse.json({
          error: "This email was previously removed from the room. Use a different email.",
        }, { status: 400 });
      }
      // Return existing member info
      return NextResponse.json({
        ok: true,
        already: true,
        member: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          ratePerKela: existing.ratePerKela,
          role: existing.role,
        },
      });
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

    // Send the invitation email (if Resend is configured)
    let emailSent = false;
    let emailError: string | undefined;
    if (sendEmail) {
      const roomUrl = `${process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`}/room/${room.code}`;
      const result = await sendInviteEmail({
        to: email,
        roomName: room.name,
        roomCode: room.code,
        inviteeName: placeholderName,
        inviterName: inviter.name,
        role: role === "minister" ? "minister" : "member",
        ratePerKela: validRate,
        roomUrl,
      });
      emailSent = result.ok;
      emailError = result.error;
    }

    return NextResponse.json({
      ok: true,
      member,
      emailSent,
      emailError: emailSent ? undefined : emailError,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

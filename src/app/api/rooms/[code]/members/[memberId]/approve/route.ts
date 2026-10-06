import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/members/[memberId]/approve
// Approves or rejects a pending member (minister only).
// Body: { memberId, action } — action: "approve" | "reject"
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const { code, memberId } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const requesterId = (body?.memberId ?? "").toString();
    const action = body?.action === "approve" ? "approve" : "reject";

    if (!requesterId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });

    // Verify the requester is a minister (or room host)
    const requester = await db.roomMember.findFirst({
      where: { id: requesterId, roomId: room.id },
    });
    if (!requester) return NextResponse.json({ error: "Requester not found." }, { status: 404 });
    const isMinister = requester.role === "minister" || requester.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can approve members." }, { status: 403 });
    }

    // Find the target member
    const target = await db.roomMember.findFirst({
      where: { id: memberId, roomId: room.id },
    });
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    if (target.status !== "pending") {
      return NextResponse.json({ error: "This member is not pending approval." }, { status: 400 });
    }

    if (action === "approve") {
      const updated = await db.roomMember.update({
        where: { id: memberId },
        data: { status: "approved" },
      });
      return NextResponse.json({ ok: true, member: updated, action: "approved" });
    } else {
      // Reject — anonymize the member (so they can't rejoin with same email)
      const anonymizedEmail = `rejected+${memberId}@deleted.local`;
      await db.roomMember.update({
        where: { id: memberId },
        data: {
          status: "rejected",
          name: "Rejected User",
          email: anonymizedEmail,
        },
      });
      return NextResponse.json({ ok: true, action: "rejected" });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

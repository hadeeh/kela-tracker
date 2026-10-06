import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/rooms/[code]/members/[memberId]
// ANONYMIZES a member (minister only) — preserves all history as a ledger.
// Instead of deleting the member + their incidents/votes (which would lose history),
// this:
//   1. Changes their name to "Removed User"
//   2. Clears their email (so they can't rejoin with the same email)
//   3. Keeps all their incidents, votes, and fines in the ledger
//   4. They can no longer log in (their localStorage identity still points to the
//      old member ID, but the email no longer matches — they'll see "join" screen)
//
// Body: { memberId } — the minister's member ID (the one doing the removing)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const { code, memberId } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const requesterId = (body?.memberId ?? "").toString();

    if (!requesterId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });

    // Verify the requester is a minister (or room host)
    const requester = await db.roomMember.findFirst({
      where: { id: requesterId, roomId: room.id },
    });
    if (!requester) return NextResponse.json({ error: "Requester not found." }, { status: 404 });
    const isMinister = requester.role === "minister" || requester.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can remove members." }, { status: 403 });
    }

    // Find the target member
    const target = await db.roomMember.findFirst({
      where: { id: memberId, roomId: room.id },
    });
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    // Don't allow the minister to remove themselves
    if (memberId === requesterId) {
      return NextResponse.json({ error: "You cannot remove yourself. Use 'Leave' instead." }, { status: 400 });
    }

    // Don't allow removing the room host
    if (target.email === room.hostEmail) {
      return NextResponse.json({ error: "Cannot remove the room host." }, { status: 400 });
    }

    // ANONYMIZE: keep the member record but remove their identity.
    // All their incidents (as accused and accuser) and votes remain in the ledger.
    // Their name shows as "Removed User" in the history.
    const anonymizedEmail = `removed+${memberId}@deleted.local`; // unique, can't rejoin
    await db.roomMember.update({
      where: { id: memberId },
      data: {
        name: "Removed User",
        email: anonymizedEmail,
        role: null, // strip minister role if they had one
      },
    });

    return NextResponse.json({
      ok: true,
      removedName: target.name,
      anonymized: true,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/rooms/[code]/members/[memberId]
// Removes a member from the room (minister only).
// Cascades: deletes their incidents (as accused), their votes, and their incidents (as accuser).
// Body: { memberId } — the minister's member ID (the one doing the deleting)
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

    // Don't allow the minister to delete themselves
    if (memberId === requesterId) {
      return NextResponse.json({ error: "You cannot remove yourself. Use 'Leave' instead." }, { status: 400 });
    }

    // Don't allow deleting the room host
    if (target.email === room.hostEmail) {
      return NextResponse.json({ error: "Cannot remove the room host." }, { status: 400 });
    }

    // Delete the member — cascades to incidents (as accused), votes, incidents (as accuser)
    await db.roomMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ ok: true, removedName: target.name });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

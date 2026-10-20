import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/wipe
// Minister-only: wipes ALL test data from a room (incidents, votes, mugshots, custom sounds,
// achievement rewards) but keeps the room itself and approved members intact.
//
// Optionally pass { keepMembers: true } (default) to preserve members. Set false to also
// remove all members except the minister.
//
// Body: { memberId, keepMembers?: boolean }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const memberId = (body?.memberId ?? "").toString();
    const keepMembers = body?.keepMembers !== false; // default true

    if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });

    // Verify minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can wipe room data." }, { status: 403 });
    }

    // 1. Find all incidents in this room
    const incidents = await db.kelaIncident.findMany({
      where: { roomId: room.id },
      select: { id: true },
    });
    const incidentIds = incidents.map((i) => i.id);

    if (incidentIds.length > 0) {
      // Delete all votes on those incidents
      await db.vote.deleteMany({ where: { incidentId: { in: incidentIds } } });
      // Delete the incidents themselves
      await db.kelaIncident.deleteMany({ where: { id: { in: incidentIds } } });
    }

    // 2. Delete mugshots in this room
    await db.mugshot.deleteMany({ where: { roomId: room.id } });

    // 3. Delete achievement rewards in this room
    await db.achievementReward.deleteMany({ where: { roomId: room.id } });

    // 4. Delete custom sounds in this room
    await db.customSound.deleteMany({ where: { roomId: room.id } });

    // 5. Optionally remove all members except the minister
    if (!keepMembers) {
      await db.roomMember.deleteMany({
        where: { roomId: room.id, id: { not: memberId } },
      });
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        incidents: incidentIds.length,
        mugshots: "all",
        achievementRewards: "all",
        customSounds: "all",
        membersKept: keepMembers,
      },
    });
  } catch (e: any) {
    console.error("Wipe error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VOTE_DURATION_MS = 30_000;
const DEFENSE_DEADLINE_MS = 30_000; // 30 seconds to submit defense

// POST /api/rooms/[code]/votes/start
// Body: { accusedId, accusedById, reason? }
// Creates a new KelaIncident with status "awaiting_defense".
// The accused must submit a defense before voting begins.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const { accusedId, accusedById, reason } = body as {
      accusedId: string;
      accusedById: string;
      reason?: string;
    };

    if (!accusedId || !accusedById) {
      return NextResponse.json({ error: "accusedId and accusedById are required." }, { status: 400 });
    }
    if (accusedId === accusedById) {
      return NextResponse.json({ error: "Cannot accuse yourself." }, { status: 400 });
    }

    // Check if there's already an active incident (awaiting defense or voting)
    const existing = await db.kelaIncident.findFirst({
      where: {
        roomId: room.id,
        status: { in: ["awaiting_defense", "voting"] },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A vote or defense is already in progress in this room." }, { status: 409 });
    }

    // Verify both members exist
    const accused = await db.roomMember.findFirst({ where: { id: accusedId, roomId: room.id } });
    if (!accused) return NextResponse.json({ error: "Accused member not found." }, { status: 404 });

    const accuser = await db.roomMember.findFirst({ where: { id: accusedById, roomId: room.id } });
    if (!accuser) return NextResponse.json({ error: "Accuser member not found." }, { status: 404 });

    // Create the incident with "awaiting_defense" status
    const now = new Date();
    const defenseDeadline = new Date(now.getTime() + DEFENSE_DEADLINE_MS);

    const incident = await db.kelaIncident.create({
      data: {
        roomId: room.id,
        userId: accusedId,
        accusedById,
        reason: reason?.toString().slice(0, 200) || null,
        rateAtTime: accused.ratePerKela,
        status: "awaiting_defense",
        defenseDeadline,
      },
    });

    return NextResponse.json({
      ok: true,
      incident: {
        id: incident.id,
        accusedId: incident.userId,
        accusedById: incident.accusedById,
        reason: incident.reason,
        status: incident.status,
        defenseDeadline: defenseDeadline.getTime(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

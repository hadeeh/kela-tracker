import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VOTE_DURATION_MS = 30_000;

// POST /api/rooms/[code]/votes/start
// Body: { accusedId, accusedById, reason? }
// Creates a new KelaIncident with status "voting" — vote starts IMMEDIATELY.
// The accused can add their defense DURING the voting (optional, not required).
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

    // Check if there's already an active incident
    const existing = await db.kelaIncident.findFirst({
      where: {
        roomId: room.id,
        status: "voting",
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A vote is already in progress in this room." }, { status: 409 });
    }

    // Verify both members exist
    const accused = await db.roomMember.findFirst({ where: { id: accusedId, roomId: room.id } });
    if (!accused) return NextResponse.json({ error: "Accused member not found." }, { status: 404 });

    const accuser = await db.roomMember.findFirst({ where: { id: accusedById, roomId: room.id } });
    if (!accuser) return NextResponse.json({ error: "Accuser member not found." }, { status: 404 });

    // Create the incident — vote starts IMMEDIATELY (status = "voting")
    // The accused can add their defense during the voting period (optional)
    const incident = await db.kelaIncident.create({
      data: {
        roomId: room.id,
        userId: accusedId,
        accusedById,
        reason: reason?.toString().slice(0, 200) || null,
        rateAtTime: accused.ratePerKela,
        status: "voting",
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
        startedAt: incident.createdAt.getTime(),
        endsAt: incident.createdAt.getTime() + VOTE_DURATION_MS,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

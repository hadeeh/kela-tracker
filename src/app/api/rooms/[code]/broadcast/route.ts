import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/broadcast
// A member broadcasts their unlocked sticker/sound to all room members.
// Body: { memberId, achievementId, type: "sticker" | "sound" }
// Returns the broadcast data. Other members pick this up via polling.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const { memberId, achievementId, type } = body as {
      memberId: string;
      achievementId: string;
      type: "sticker" | "sound";
    };

    if (!memberId || !achievementId || !type) {
      return NextResponse.json({ error: "memberId, achievementId, and type are required." }, { status: 400 });
    }

    // Verify member exists
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Get the achievement reward
    const reward = await db.achievementReward.findUnique({
      where: { roomId_achievementId: { roomId: room.id, achievementId } },
    });
    if (!reward) return NextResponse.json({ error: "No reward found for this achievement." }, { status: 404 });

    if (type === "sticker" && !reward.stickerData) {
      return NextResponse.json({ error: "No sticker uploaded for this achievement." }, { status: 400 });
    }
    if (type === "sound" && !reward.soundData) {
      return NextResponse.json({ error: "No sound uploaded for this achievement." }, { status: 400 });
    }

    // Store broadcast info — we'll use a simple approach: return the data
    // The SoundBar component polls this endpoint and picks up new broadcasts
    const broadcastTs = Date.now();

    // Update the reward's updatedAt so polling picks it up
    await db.achievementReward.update({
      where: { roomId_achievementId: { roomId: room.id, achievementId } },
      data: { updatedAt: new Date(broadcastTs) },
    });

    return NextResponse.json({
      ok: true,
      broadcast: {
        type,
        achievementId,
        memberName: member.name,
        stickerUrl: type === "sticker" ? `/api/rooms/${room.code}/achievements/${achievementId}/sticker` : null,
        soundUrl: type === "sound" ? `/api/rooms/${room.code}/achievements/${achievementId}/sound` : null,
        timestamp: broadcastTs,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// GET /api/rooms/[code]/broadcast?ts=xxx
// Returns latest broadcast (if any after the given timestamp)
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const since = parseInt(url.searchParams.get("ts") || "0", 10);

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Check for recently updated achievement rewards (within last 10 seconds)
    const recentRewards = await db.achievementReward.findMany({
      where: {
        roomId: room.id,
        updatedAt: { gt: new Date(since) },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    if (recentRewards.length === 0) {
      return NextResponse.json({ broadcast: null });
    }

    const reward = recentRewards[0];
    // We don't store who broadcasted in the reward table, so we can't return the name here.
    // The POST response includes the name. For polling, we'll just return the URLs.
    return NextResponse.json({
      broadcast: {
        achievementId: reward.achievementId,
        memberName: "Someone",
        stickerUrl: reward.stickerData ? `/api/rooms/${room.code}/achievements/${reward.achievementId}/sticker` : null,
        soundUrl: reward.soundData ? `/api/rooms/${room.code}/achievements/${reward.achievementId}/sound` : null,
        timestamp: reward.updatedAt.getTime(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

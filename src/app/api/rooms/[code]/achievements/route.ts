import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const VALID_ACHIEVEMENT_IDS = [
  // Accuser achievements
  "first-blood", "watchdog", "hunter", "instigator",
  "prosecutor", "sniper", "godfather",
  // Eater badge sounds
  "badge-rookie", "badge-starter", "badge-bronze", "badge-silver",
  "badge-gold", "badge-platinum", "badge-diamond",
];

// GET /api/rooms/[code]/achievements — list all achievement rewards
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const rewards = await db.achievementReward.findMany({
      where: { roomId: room.id },
    });

    const result: Record<string, { stickerUrl: string | null; soundUrl: string | null }> = {};
    for (const id of VALID_ACHIEVEMENT_IDS) {
      const reward = rewards.find((r) => r.achievementId === id);
      result[id] = {
        stickerUrl: reward?.stickerData ? `/api/rooms/${room.code}/achievements/${id}/sticker` : null,
        soundUrl: reward?.soundData ? `/api/rooms/${room.code}/achievements/${id}/sound` : null,
      };
    }
    return NextResponse.json({ rewards: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// POST /api/rooms/[code]/achievements — upload sticker/sound for an achievement (minister only)
// FormData: memberId, achievementId, sticker (file), sound (file)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const formData = await req.formData();
    const memberId = formData.get("memberId") as string;
    const achievementId = formData.get("achievementId") as string;
    const stickerFile = formData.get("sticker") as File | null;
    const soundFile = formData.get("sound") as File | null;

    if (!memberId || !achievementId) {
      return NextResponse.json({ error: "memberId and achievementId are required." }, { status: 400 });
    }
    if (!VALID_ACHIEVEMENT_IDS.includes(achievementId)) {
      return NextResponse.json({ error: "Invalid achievement ID." }, { status: 400 });
    }
    if (!stickerFile && !soundFile) {
      return NextResponse.json({ error: "Provide at least a sticker or sound file." }, { status: 400 });
    }

    // Verify minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can upload achievement rewards." }, { status: 403 });
    }

    const updateData: any = {};
    if (stickerFile) {
      if (stickerFile.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Sticker too large. Max 2MB." }, { status: 400 });
      updateData.stickerData = Buffer.from(await stickerFile.arrayBuffer());
      updateData.stickerMime = stickerFile.type || "image/png";
    }
    if (soundFile) {
      if (soundFile.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Sound too large. Max 2MB." }, { status: 400 });
      updateData.soundData = Buffer.from(await soundFile.arrayBuffer());
      updateData.soundMime = soundFile.type || "audio/wav";
    }

    await db.achievementReward.upsert({
      where: { roomId_achievementId: { roomId: room.id, achievementId } },
      create: { roomId: room.id, achievementId, ...updateData },
      update: updateData,
    });

    return NextResponse.json({ ok: true, achievementId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// DELETE /api/rooms/[code]/achievements — remove sticker/sound (minister only)
export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const { memberId, achievementId, type } = body as {
      memberId: string; achievementId: string; type: "sticker" | "sound";
    };

    if (!memberId || !achievementId || !type) {
      return NextResponse.json({ error: "memberId, achievementId, and type are required." }, { status: 400 });
    }

    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can remove achievement rewards." }, { status: 403 });
    }

    const updateData = type === "sticker"
      ? { stickerData: null, stickerMime: null }
      : { soundData: null, soundMime: null };

    await db.achievementReward.upsert({
      where: { roomId_achievementId: { roomId: room.id, achievementId } },
      create: { roomId: room.id, achievementId, ...updateData },
      update: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

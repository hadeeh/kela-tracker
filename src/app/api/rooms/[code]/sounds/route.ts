import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_TYPES = [
  "vote-start", "kela-vote", "saeb-vote", "result-kela",
  "badge-rookie", "badge-starter", "badge-bronze", "badge-silver",
  "badge-gold", "badge-platinum", "badge-diamond",
];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (stored in DB, keep small)

// GET /api/rooms/[code]/sounds — list which custom sounds exist for this room
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const customs = await db.customSound.findMany({ where: { roomId: room.id } });
    const sounds: Record<string, string | null> = {};
    for (const t of VALID_TYPES) {
      const c = customs.find((s) => s.soundType === t);
      sounds[t] = c ? `/api/rooms/${room.code}/sounds/${t}` : null;
    }
    return NextResponse.json({ sounds });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// POST /api/rooms/[code]/sounds — upload a custom sound (minister only)
// Multipart form: memberId, soundType, file
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const formData = await req.formData();
    const memberId = formData.get("memberId") as string;
    const soundType = formData.get("soundType") as string;
    const file = formData.get("file") as File | null;

    if (!memberId || !soundType || !file) {
      return NextResponse.json({ error: "memberId, soundType, and file are required." }, { status: 400 });
    }
    if (!VALID_TYPES.includes(soundType)) {
      return NextResponse.json({ error: "Invalid sound type. Must be one of: " + VALID_TYPES.join(", ") }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
    }

    // Verify the member is a minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (member.role !== "minister") {
      return NextResponse.json({ error: "Only the Kela Minister can manage sounds." }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "audio/wav";

    // Upsert (replace if exists)
    await db.customSound.upsert({
      where: { roomId_soundType: { roomId: room.id, soundType } },
      create: {
        roomId: room.id,
        soundType,
        data: buffer,
        mimeType,
        fileName: file.name,
      },
      update: {
        data: buffer,
        mimeType,
        fileName: file.name,
      },
    });

    return NextResponse.json({
      ok: true,
      soundType,
      url: `/api/rooms/${room.code}/sounds/${soundType}`,
      size: file.size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// DELETE /api/rooms/[code]/sounds — reset a sound to default (minister only)
export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const { memberId, soundType } = body as { memberId: string; soundType: string };

    if (!memberId || !soundType) {
      return NextResponse.json({ error: "memberId and soundType are required." }, { status: 400 });
    }
    if (!VALID_TYPES.includes(soundType)) {
      return NextResponse.json({ error: "Invalid sound type." }, { status: 400 });
    }

    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (member.role !== "minister") {
      return NextResponse.json({ error: "Only the Kela Minister can manage sounds." }, { status: 403 });
    }

    await db.customSound.deleteMany({
      where: { roomId: room.id, soundType },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

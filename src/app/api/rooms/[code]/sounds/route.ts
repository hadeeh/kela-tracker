import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const SOUND_DIR = "/home/z/my-project/public/sounds/rooms";
const VALID_TYPES = ["vote-start", "kela-vote", "saeb-vote"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// GET /api/rooms/[code]/sounds — list custom sounds for this room
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const roomDir = path.join(SOUND_DIR, room.code);
    const sounds: Record<string, string | null> = {};
    for (const t of VALID_TYPES) {
      sounds[t] = null;
      for (const ext of ["wav", "mp3", "ogg", "webm", "m4a"]) {
        if (existsSync(path.join(roomDir, `${t}.${ext}`))) {
          sounds[t] = `/sounds/rooms/${room.code}/${t}.${ext}`;
          break;
        }
      }
    }
    return NextResponse.json({ sounds });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// POST /api/rooms/[code]/sounds — upload a custom sound (sultan only)
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
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
    }

    // Verify the member is a sultan
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (member.role !== "sultan") {
      return NextResponse.json({ error: "Only the Kela Sultan can manage sounds." }, { status: 403 });
    }

    // Determine extension from file type
    const ext = file.name.split(".").pop()?.toLowerCase() || "wav";
    const validExts = ["wav", "mp3", "ogg", "webm", "m4a"];
    if (!validExts.includes(ext)) {
      return NextResponse.json({ error: "Invalid file type. Use wav, mp3, ogg, webm, or m4a." }, { status: 400 });
    }

    // Ensure directory exists
    const roomDir = path.join(SOUND_DIR, room.code);
    if (!existsSync(roomDir)) {
      await mkdir(roomDir, { recursive: true });
    }

    // Remove old files of this type (any extension)
    for (const oldExt of validExts) {
      const oldPath = path.join(roomDir, `${soundType}.${oldExt}`);
      if (existsSync(oldPath)) {
        try { await unlink(oldPath); } catch {}
      }
    }

    // Save the new file
    const filePath = path.join(roomDir, `${soundType}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({
      ok: true,
      soundType,
      url: `/sounds/rooms/${room.code}/${soundType}.${ext}`,
      size: file.size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// DELETE /api/rooms/[code]/sounds — reset a sound to default (sultan only)
// Body: { memberId, soundType }
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
    if (member.role !== "sultan") {
      return NextResponse.json({ error: "Only the Kela Sultan can manage sounds." }, { status: 403 });
    }

    const roomDir = path.join(SOUND_DIR, room.code);
    const validExts = ["wav", "mp3", "ogg", "webm", "m4a"];
    let deleted = false;
    for (const ext of validExts) {
      const filePath = path.join(roomDir, `${soundType}.${ext}`);
      if (existsSync(filePath)) {
        try { await unlink(filePath); deleted = true; } catch {}
      }
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

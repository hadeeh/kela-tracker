import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// GET /api/rooms/[code]/mugshots — list all mugshots (Hall of Shame)
// Optional query: ?memberId=xxx — filter by target member (for per-user gallery)
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const targetMemberId = url.searchParams.get("memberId");

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const where: any = { roomId: room.id };
    if (targetMemberId) {
      where.targetMemberId = targetMemberId;
    }

    // Get mugshots + look up target member names
    const mugshots = await db.mugshot.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get all target member names in one query
    const memberIds = [...new Set(mugshots.map((m) => m.targetMemberId).filter(Boolean))] as string[];
    const members = await db.roomMember.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true },
    });
    const memberMap = new Map(members.map((m) => [m.id, m.name]));

    return NextResponse.json({
      mugshots: mugshots.map((m) => ({
        id: m.id,
        uploaderId: m.uploaderId,
        targetMemberId: m.targetMemberId,
        targetMemberName: m.targetMemberId ? (memberMap.get(m.targetMemberId) || "Removed User") : "Unknown",
        caption: m.caption,
        createdAt: m.createdAt,
        url: `/api/rooms/${room.code}/mugshots/${m.id}`,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// POST /api/rooms/[code]/mugshots — upload a mugshot
// FormData: uploaderId, targetMemberId (who the photo is of), caption, file
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const formData = await req.formData();
    const uploaderId = formData.get("uploaderId") as string;
    const targetMemberId = formData.get("targetMemberId") as string | null;
    const caption = formData.get("caption") as string | null;
    const file = formData.get("file") as File | null;

    if (!uploaderId || !file) {
      return NextResponse.json({ error: "uploaderId and file are required." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
    }

    const member = await db.roomMember.findFirst({ where: { id: uploaderId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Verify target member exists (if provided)
    if (targetMemberId) {
      const target = await db.roomMember.findFirst({ where: { id: targetMemberId, roomId: room.id } });
      if (!target) return NextResponse.json({ error: "Target member not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";

    const mugshot = await db.mugshot.create({
      data: {
        roomId: room.id,
        uploaderId,
        targetMemberId: targetMemberId || null,
        caption: caption?.slice(0, 200) || null,
        data: buffer,
        mimeType,
      },
    });

    return NextResponse.json({
      ok: true,
      id: mugshot.id,
      url: `/api/rooms/${room.code}/mugshots/${mugshot.id}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

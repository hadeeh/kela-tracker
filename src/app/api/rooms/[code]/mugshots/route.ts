import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// GET /api/rooms/[code]/mugshots — list all mugshots (Hall of Shame)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const mugshots = await db.mugshot.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        incidents: { select: { id: true, user: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({
      mugshots: mugshots.map((m) => ({
        id: m.id,
        uploaderId: m.uploaderId,
        incidentId: m.incidentId,
        caption: m.caption,
        createdAt: m.createdAt,
        url: `/api/rooms/${room.code}/mugshots/${m.id}`,
        accusedName: m.incidents[0]?.user?.name || "Unknown",
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// POST /api/rooms/[code]/mugshots — upload a mugshot (minister or guilty person)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const formData = await req.formData();
    const uploaderId = formData.get("uploaderId") as string;
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";

    const mugshot = await db.mugshot.create({
      data: {
        roomId: room.id,
        uploaderId,
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

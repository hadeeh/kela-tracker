import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/rooms/[code]/assets/[assetKey]/history
// Lists all historical versions of an asset (sound or sticker).
// Minister-only.
//
// assetKey examples:
//   "sound:vote-start"
//   "sound:badge-rookie"
//   "sticker:first-blood"
//   "sound:first-blood"
//
// Returns metadata only (no data bytes) — preview/play via the version-audio endpoint.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string; assetKey: string }> }
) {
  try {
    const { code, assetKey } = await params;
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Verify minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can view asset history." }, { status: 403 });
    }

    const versions = await db.assetVersion.findMany({
      where: { roomId: room.id, assetKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mimeType: true,
        fileName: true,
        uploadedBy: true,
        note: true,
        createdAt: true,
      },
    });

    // Look up uploader names
    const uploaderIds = [...new Set(versions.map((v) => v.uploadedBy).filter(Boolean))] as string[];
    const uploaders = await db.roomMember.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, name: true },
    });
    const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name]));

    return NextResponse.json({
      assetKey,
      versions: versions.map((v) => ({
        id: v.id,
        mimeType: v.mimeType,
        fileName: v.fileName,
        uploadedBy: v.uploadedBy,
        uploadedByName: v.uploadedBy ? (uploaderMap.get(v.uploadedBy) || "Unknown") : null,
        note: v.note,
        createdAt: v.createdAt,
        previewUrl: `/api/rooms/${room.code}/assets/${assetKey}/history/${v.id}`,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/rooms/[code]/assets/[assetKey]/history/[versionId]
// Returns the raw bytes of a specific historical asset version.
// Minister-only (so members can't browse old uploads).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string; assetKey: string; versionId: string }> }
) {
  try {
    const { code, assetKey, versionId } = await params;
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
      return NextResponse.json({ error: "Only the Kela Minister can preview asset history." }, { status: 403 });
    }

    const version = await db.assetVersion.findFirst({
      where: { id: versionId, roomId: room.id, assetKey },
    });
    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    return new NextResponse(version.data, {
      status: 200,
      headers: {
        "Content-Type": version.mimeType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

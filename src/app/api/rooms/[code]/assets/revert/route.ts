import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rooms/[code]/assets/revert
// Reverts an asset (sound or sticker) to a specific historical version.
// Minister-only.
//
// Body: { memberId, assetKey, versionId }
//
// Behavior:
//   1. Read the target version from AssetVersion.
//   2. Push the CURRENT live data to AssetVersion (so the timeline is preserved
//      bidirectionally — reverting creates a new "current" but doesn't lose the
//      version you just reverted from).
//   3. Write the version's bytes back to the live table (CustomSound or
//      AchievementReward).
//
// assetKey determines which live table to update:
//   "sound:<type>" with type in VALID_SOUND_TYPES → CustomSound
//   "sound:<achievementId>" (e.g., "sound:badge-rookie", "sound:first-blood") → AchievementReward.soundData
//   "sticker:<achievementId>" → AchievementReward.stickerData

const VALID_SOUND_TYPES = [
  "vote-start", "kela-vote", "saeb-vote", "result-kela",
];
// Note: badge-* and accuser achievement IDs all live in AchievementReward.

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const { memberId, assetKey, versionId } = body as {
      memberId: string; assetKey: string; versionId: string;
    };

    if (!memberId || !assetKey || !versionId) {
      return NextResponse.json({ error: "memberId, assetKey, and versionId are required." }, { status: 400 });
    }

    // Verify minister
    const member = await db.roomMember.findFirst({ where: { id: memberId, roomId: room.id } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const isMinister = member.role === "minister" || member.email === room.hostEmail;
    if (!isMinister) {
      return NextResponse.json({ error: "Only the Kela Minister can revert assets." }, { status: 403 });
    }

    // Find the target version
    const version = await db.assetVersion.findFirst({
      where: { id: versionId, roomId: room.id, assetKey },
    });
    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    // Parse assetKey
    const [kind, refId] = assetKey.split(":");
    if (!kind || !refId || !["sound", "sticker"].includes(kind)) {
      return NextResponse.json({ error: "Invalid assetKey format. Expected 'sound:<id>' or 'sticker:<id>'." }, { status: 400 });
    }

    // Push the current live data to history (so reverting is reversible)
    if (kind === "sound" && VALID_SOUND_TYPES.includes(refId)) {
      // CustomSound table
      const existing = await db.customSound.findUnique({
        where: { roomId_soundType: { roomId: room.id, soundType: refId } },
      });
      if (existing) {
        await db.assetVersion.create({
          data: {
            roomId: room.id,
            assetKey,
            data: existing.data,
            mimeType: existing.mimeType,
            fileName: existing.fileName,
            uploadedBy: memberId,
            note: "Auto-saved before revert",
          },
        });
      }
      // Write the version's bytes back
      await db.customSound.upsert({
        where: { roomId_soundType: { roomId: room.id, soundType: refId } },
        create: {
          roomId: room.id,
          soundType: refId,
          data: version.data,
          mimeType: version.mimeType,
          fileName: version.fileName || "reverted",
        },
        update: {
          data: version.data,
          mimeType: version.mimeType,
          fileName: version.fileName || "reverted",
        },
      });
    } else {
      // AchievementReward table — refId is the achievementId
      const existing = await db.achievementReward.findUnique({
        where: { roomId_achievementId: { roomId: room.id, achievementId: refId } },
      });
      if (existing) {
        if (kind === "sound" && existing.soundData) {
          await db.assetVersion.create({
            data: {
              roomId: room.id,
              assetKey,
              data: existing.soundData,
              mimeType: existing.soundMime || "audio/wav",
              fileName: null,
              uploadedBy: memberId,
              note: "Auto-saved before revert",
            },
          });
        } else if (kind === "sticker" && existing.stickerData) {
          await db.assetVersion.create({
            data: {
              roomId: room.id,
              assetKey,
              data: existing.stickerData,
              mimeType: existing.stickerMime || "image/png",
              fileName: null,
              uploadedBy: memberId,
              note: "Auto-saved before revert",
            },
          });
        }
      }
      // Write the version's bytes back
      const updateData =
        kind === "sound"
          ? { soundData: version.data, soundMime: version.mimeType }
          : { stickerData: version.data, stickerMime: version.mimeType };
      await db.achievementReward.upsert({
        where: { roomId_achievementId: { roomId: room.id, achievementId: refId } },
        create: { roomId: room.id, achievementId: refId, ...updateData },
        update: updateData,
      });
    }

    return NextResponse.json({
      ok: true,
      assetKey,
      revertedTo: { id: version.id, createdAt: version.createdAt },
    });
  } catch (e: any) {
    console.error("Revert error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

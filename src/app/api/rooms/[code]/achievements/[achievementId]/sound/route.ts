import { db } from "@/lib/db";

// GET /api/rooms/[code]/achievements/[achievementId]/sound — serve unlock sound
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string; achievementId: string }> }
) {
  try {
    const { code, achievementId } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return new Response("Not found", { status: 404 });

    const reward = await db.achievementReward.findUnique({
      where: { roomId_achievementId: { roomId: room.id, achievementId } },
    });
    if (!reward?.soundData) return new Response("Not found", { status: 404 });

    return new Response(reward.soundData, {
      headers: {
        "Content-Type": reward.soundMime || "audio/wav",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new Response("Server error", { status: 500 });
  }
}

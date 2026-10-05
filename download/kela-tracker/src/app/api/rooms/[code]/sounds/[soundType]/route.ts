import { db } from "@/lib/db";

// GET /api/rooms/[code]/sounds/[soundType] — serve the custom sound file from DB
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string; soundType: string }> }
) {
  try {
    const { code, soundType } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return new Response("Not found", { status: 404 });

    const sound = await db.customSound.findUnique({
      where: { roomId_soundType: { roomId: room.id, soundType } },
    });
    if (!sound) return new Response("Not found", { status: 404 });

    return new Response(sound.data, {
      headers: {
        "Content-Type": sound.mimeType,
        "Content-Length": String(sound.data.length),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e: any) {
    return new Response("Server error", { status: 500 });
  }
}

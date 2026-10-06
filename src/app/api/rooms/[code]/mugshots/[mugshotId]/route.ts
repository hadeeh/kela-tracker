import { db } from "@/lib/db";

// GET /api/rooms/[code]/mugshots/[mugshotId] — serve the mugshot image
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string; mugshotId: string }> }
) {
  try {
    const { code, mugshotId } = await params;
    const room = await db.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return new Response("Not found", { status: 404 });

    const mugshot = await db.mugshot.findFirst({
      where: { id: mugshotId, roomId: room.id },
    });
    if (!mugshot) return new Response("Not found", { status: 404 });

    return new Response(mugshot.data, {
      headers: {
        "Content-Type": mugshot.mimeType,
        "Content-Length": String(mugshot.data.length),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e: any) {
    return new Response("Server error", { status: 500 });
  }
}

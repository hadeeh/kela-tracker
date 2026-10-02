import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Internal endpoint to create an incident when a vote is initiated.
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "kela-internal-2026";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-internal-secret");
    if (secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { accusedId, accusedById, reason } = body as {
      accusedId: string;
      accusedById: string;
      reason?: string;
    };

    if (!accusedId || !accusedById) {
      return NextResponse.json({ error: "accusedId and accusedById required" }, { status: 400 });
    }
    if (accusedId === accusedById) {
      return NextResponse.json({ error: "Cannot accuse yourself" }, { status: 400 });
    }

    const accused = await db.user.findUnique({ where: { id: accusedId } });
    if (!accused) {
      return NextResponse.json({ error: "Accused user not found" }, { status: 404 });
    }

    const incident = await db.kelaIncident.create({
      data: {
        userId: accusedId,
        accusedBy: accusedById,
        reason: reason?.toString().slice(0, 200) || null,
      },
    });

    return NextResponse.json({ ok: true, incident });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

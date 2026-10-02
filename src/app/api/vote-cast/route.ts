import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Internal endpoint called by the websocket service to persist a vote.
// Secured via a shared secret header.
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "kela-internal-2026";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-internal-secret");
    if (secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { incidentId, voterId, choice } = body as {
      incidentId: string;
      voterId: string;
      choice: "kela" | "saeb";
    };

    if (!incidentId || !voterId || (choice !== "kela" && choice !== "saeb")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const incident = await db.kelaIncident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    if (incident.verdict !== "pending") {
      return NextResponse.json({ error: "Voting already closed" }, { status: 400 });
    }
    if (incident.userId === voterId) {
      return NextResponse.json({ error: "Accused cannot vote" }, { status: 400 });
    }

    // Create the vote (unique constraint protects against double-voting)
    try {
      await db.vote.create({
        data: { incidentId, voterId, choice },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }
      throw e;
    }

    // Update counts
    const updated = await db.kelaIncident.update({
      where: { id: incidentId },
      data: {
        votesYes: { increment: choice === "kela" ? 1 : 0 },
        votesNo: { increment: choice === "saeb" ? 1 : 0 },
      },
      select: { votesYes: true, votesNo: true, userId: true },
    });

    return NextResponse.json({ ok: true, votesYes: updated.votesYes, votesNo: updated.votesNo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// Finalize an incident with a verdict (called by WS service after timer expires
// or all eligible voters voted).
export async function PUT(req: Request) {
  try {
    const secret = req.headers.get("x-internal-secret");
    if (secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { incidentId, verdict } = body as {
      incidentId: string;
      verdict: "kela" | "saeb" | "tie";
    };

    if (!incidentId || !["kela", "saeb", "tie"].includes(verdict)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await db.kelaIncident.updateMany({
      where: { id: incidentId, verdict: "pending" },
      data: { verdict },
    });

    return NextResponse.json({ ok: true, matched: updated.count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

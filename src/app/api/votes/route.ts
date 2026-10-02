import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const meId = (session.user as any).id as string;

  const votes = await db.vote.findMany({
    where: { voterId: meId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      incident: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ votes });
}

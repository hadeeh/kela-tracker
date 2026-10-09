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

  const users = await db.user.findMany({
    where: { NOT: { id: meId } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      ratePerKela: true,
      createdAt: true,
      _count: { select: { incidents: true } },
    },
  });

  // total fines per user (sum of ratePerKela at the time of each guilty verdict).
  // For simplicity we sum current ratePerKela * guiltyIncidents.
  const me = await db.user.findUnique({
    where: { id: meId },
    select: {
      id: true,
      name: true,
      email: true,
      ratePerKela: true,
    },
  });

  return NextResponse.json({ me, users });
}

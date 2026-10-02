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

  // Recent incidents across everyone (so the whole friend circle sees the drama)
  const incidents = await db.kelaIncident.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, email: true, ratePerKela: true } },
      votes: {
        include: { voter: { select: { id: true, name: true } } },
      },
    },
  });

  // Total fine for me (guilty verdicts * my rate)
  const myGuilty = await db.kelaIncident.count({
    where: { userId: meId, verdict: "kela" },
  });
  const me = await db.user.findUnique({
    where: { id: meId },
    select: { ratePerKela: true },
  });
  const myFine = myGuilty * (me?.ratePerKela ?? 0);

  return NextResponse.json({ incidents, myGuiltyCount: myGuilty, myFine });
}

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
  const me = await db.user.findUnique({
    where: { id: meId },
    select: { ratePerKela: true },
  });
  return NextResponse.json({ ratePerKela: me?.ratePerKela ?? 50 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const meId = (session.user as any).id as string;

  let rate: number | null = null;
  try {
    const body = await req.json();
    rate = Number(body?.ratePerKela);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (rate === null || Number.isNaN(rate) || rate < 0 || rate > 100000) {
    return NextResponse.json({ error: "Rate must be between 0 and 100000." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: meId },
    data: { ratePerKela: Math.round(rate) },
    select: { ratePerKela: true },
  });

  return NextResponse.json({ ok: true, ratePerKela: updated.ratePerKela });
}

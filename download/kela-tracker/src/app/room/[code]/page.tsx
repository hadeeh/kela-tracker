import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RoomClientShell } from "@/components/kela/room-client-shell";

type Props = { params: Promise<{ code: string }> };

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();

  const room = await db.room.findUnique({
    where: { code: normalizedCode },
    select: { id: true, code: true, name: true, hostEmail: true, createdAt: true },
  });
  if (!room) notFound();

  return <RoomClientShell room={room} />;
}

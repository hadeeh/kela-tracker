import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthScreen } from "@/components/kela/auth-screen";
import { Dashboard } from "@/components/kela/dashboard";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return <AuthScreen />;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, ratePerKela: true },
  });

  if (!user) {
    return <AuthScreen />;
  }

  return <Dashboard me={user} />;
}

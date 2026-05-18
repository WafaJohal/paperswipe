import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function FeedPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <p className="text-white/50">Feed coming in Step 5.</p>
    </main>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { FeedShell } from "@/components/layout/FeedShell";

export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  return <FeedShell>{children}</FeedShell>;
}

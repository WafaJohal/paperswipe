import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FeedShell } from "@/components/layout/FeedShell";

export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const isGuest = !session;

  return <FeedShell isGuest={isGuest}>{children}</FeedShell>;
}

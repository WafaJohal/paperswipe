import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getRequiredUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return {
    user: session.user as {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    },
    error: null,
  };
}

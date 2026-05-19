import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRequiredUser } from "@/lib/session";

export async function DELETE() {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  // Cascades delete UserSettings and SeenPaper rows via schema onDelete: Cascade
  await db.user.delete({ where: { id: user.id } });

  // Invalidate the session cookie by returning a sign-out redirect hint.
  // The client must call signOut() after receiving 200.
  return NextResponse.json({ ok: true });
}

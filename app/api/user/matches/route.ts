import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequiredUser } from "@/lib/session";

export async function GET() {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const [asUser1, asUser2] = await Promise.all([
    db.match.findMany({
      where: { user1Id: user.id, seen1: false },
      include: { user2: { select: { id: true, name: true, image: true } } },
    }),
    db.match.findMany({
      where: { user2Id: user.id, seen2: false },
      include: { user1: { select: { id: true, name: true, image: true } } },
    }),
  ]);

  const [settings1, settings2] = await Promise.all([
    db.userSettings.findMany({
      where: { userId: { in: asUser1.map((m) => m.user2Id) } },
      select: { userId: true, orcid: true },
    }),
    db.userSettings.findMany({
      where: { userId: { in: asUser2.map((m) => m.user1Id) } },
      select: { userId: true, orcid: true },
    }),
  ]);

  const orcidMap = Object.fromEntries(
    [...settings1, ...settings2].map((s) => [s.userId, s.orcid])
  );

  const matches = [
    ...asUser1.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      otherUser: { ...m.user2, orcid: orcidMap[m.user2Id] ?? null },
      // paper1 is the paper by user2 that user1 (me) liked
      myLikedPaper: { id: m.paper1Id, title: m.paper1Title },
      theirLikedPaper: { id: m.paper2Id, title: m.paper2Title },
    })),
    ...asUser2.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      otherUser: { ...m.user1, orcid: orcidMap[m.user1Id] ?? null },
      myLikedPaper: { id: m.paper2Id, title: m.paper2Title },
      theirLikedPaper: { id: m.paper1Id, title: m.paper1Title },
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ matches });
}

// Mark a match as seen for the current user
export async function PATCH(req: NextRequest) {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const { matchId } = await req.json();
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (match.user1Id === user.id) {
    await db.match.update({ where: { id: matchId }, data: { seen1: true } });
  } else if (match.user2Id === user.id) {
    await db.match.update({ where: { id: matchId }, data: { seen2: true } });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

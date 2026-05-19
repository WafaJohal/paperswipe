import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequiredUser } from "@/lib/session";

export async function GET() {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const seen = await db.seenPaper.findMany({
    where: { userId: user.id },
    select: { openAlexId: true },
  });

  return NextResponse.json({ ids: seen.map((s) => s.openAlexId) });
}

const SeenBatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const body = await req.json();
  const parsed = SeenBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await db.seenPaper.createMany({
    data: parsed.data.ids.map((id) => ({ userId: user.id, openAlexId: id })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}

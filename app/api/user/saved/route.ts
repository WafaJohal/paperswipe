import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequiredUser } from "@/lib/session";

const AuthorSchema = z.object({
  name: z.string(),
  orcid: z.string().nullable(),
});

const SaveSchema = z.object({
  openAlexId: z.string(),
  title: z.string(),
  authorships: z.array(AuthorSchema),
});

export async function POST(req: NextRequest) {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const body = await req.json();
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { openAlexId, title, authorships } = parsed.data;

  // Upsert the saved paper
  await db.savedPaper.upsert({
    where: { userId_openAlexId: { userId: user.id, openAlexId } },
    update: {},
    create: { userId: user.id, openAlexId, title, authors: authorships },
  });

  // Get this user's ORCID to check if others have saved their papers
  const mySettings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: { orcid: true },
  });

  const match = await detectMatch({
    savingUserId: user.id,
    savedPaperId: openAlexId,
    savedPaperTitle: title,
    savedPaperAuthorships: authorships,
    myOrcid: mySettings?.orcid ?? null,
  });

  return NextResponse.json({ ok: true, match });
}

interface MatchInput {
  savingUserId: string;
  savedPaperId: string;
  savedPaperTitle: string;
  savedPaperAuthorships: { name: string; orcid: string | null }[];
  myOrcid: string | null;
}

interface MatchResult {
  found: true;
  matchId: string;
  otherUser: { id: string; name: string | null; image: string | null; orcid: string | null };
  theirPaper: { id: string; title: string };
  myPaper: { id: string; title: string };
} | { found: false }

async function detectMatch(input: MatchInput): Promise<MatchResult> {
  const { savingUserId, savedPaperId, savedPaperTitle, savedPaperAuthorships, myOrcid } = input;

  // Collect ORCIDs of the paper's authors (strip URL prefix)
  const authorOrcids = savedPaperAuthorships
    .map((a) => a.orcid?.replace("https://orcid.org/", "").trim())
    .filter((o): o is string => Boolean(o));

  if (authorOrcids.length === 0) return { found: false };

  // Find PaperSwipe users whose ORCID matches one of the paper's authors
  const authorUsers = await db.userSettings.findMany({
    where: {
      orcid: { in: authorOrcids },
      userId: { not: savingUserId },
    },
    select: {
      userId: true,
      orcid: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  if (authorUsers.length === 0) return { found: false };

  // For each matched author-user, check if they have saved a paper by the current user
  if (!myOrcid) return { found: false };

  const myOrcidClean = myOrcid.replace("https://orcid.org/", "").trim();

  for (const authorUser of authorUsers) {
    // Look for a paper saved by authorUser that lists the current user as author (by ORCID)
    const theirSaves = await db.savedPaper.findMany({
      where: { userId: authorUser.userId },
      select: { openAlexId: true, title: true, authors: true },
    });

    const reciprocalSave = theirSaves.find((saved) => {
      const authors = saved.authors as { name: string; orcid: string | null }[];
      return authors.some(
        (a) => a.orcid?.replace("https://orcid.org/", "").trim() === myOrcidClean
      );
    });

    if (!reciprocalSave) continue;

    // It's a match! Upsert so we don't double-create if triggered concurrently.
    const [u1, u2] = [savingUserId, authorUser.userId].sort();
    const isUser1 = savingUserId === u1;

    const matchRecord = await db.match.upsert({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      update: {},
      create: {
        user1Id: u1,
        user2Id: u2,
        paper1Id: isUser1 ? savedPaperId : reciprocalSave.openAlexId,
        paper1Title: isUser1 ? savedPaperTitle : reciprocalSave.title,
        paper2Id: isUser1 ? reciprocalSave.openAlexId : savedPaperId,
        paper2Title: isUser1 ? reciprocalSave.title : savedPaperTitle,
      },
    });

    const otherSettings = await db.userSettings.findUnique({
      where: { userId: authorUser.userId },
      select: { orcid: true },
    });

    return {
      found: true,
      matchId: matchRecord.id,
      otherUser: {
        id: authorUser.userId,
        name: authorUser.user.name,
        image: authorUser.user.image,
        orcid: otherSettings?.orcid ?? null,
      },
      theirPaper: { id: savedPaperId, title: savedPaperTitle },
      myPaper: { id: reciprocalSave.openAlexId, title: reciprocalSave.title },
    };
  }

  return { found: false };
}

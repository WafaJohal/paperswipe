import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt, decrypt, maskApiKey } from "@/lib/crypto";
import { getRequiredUser } from "@/lib/session";

/** Venue as stored in DB — { name, id } where id is an OpenAlex source ID. */
const VenueFilterSchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1),
});

const UpdateSettingsSchema = z.object({
  orcid: z.string().optional(),
  zoteroApiKey: z.string().min(1).optional(),
  zoteroUserId: z.string().optional(),
  zoteroLibraryType: z.enum(["user", "group"]).optional(),
  zoteroCollectionKey: z.string().optional(),
  zoteroMaybeCollectionKey: z.string().optional(),
  filterKeywords: z.array(z.string()).optional(),
  filterDateRange: z.enum(["week", "month", "quarter", "year"]).optional(),
  filterVenues: z.array(VenueFilterSchema).optional(),
  // filterWorkType and filterOpenAccessOnly have no DB columns yet.
  // They are stored in sessionStorage client-side and passed as query params.
});

export async function GET() {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!settings) {
    return NextResponse.json({ settings: null });
  }

  const { zoteroApiKeyEncrypted, ...rest } = settings;

  let maskedKey: string | null = null;
  if (zoteroApiKeyEncrypted) {
    try {
      maskedKey = maskApiKey(decrypt(zoteroApiKeyEncrypted));
    } catch {
      maskedKey = "••••••••(error)";
    }
  }

  return NextResponse.json({ settings: { ...rest, zoteroApiKeyMasked: maskedKey } });
}

export async function PUT(req: NextRequest) {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const body = await req.json();
  const parsed = UpdateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { zoteroApiKey, ...rest } = parsed.data;

  const data: Record<string, unknown> = { ...rest };
  if (zoteroApiKey !== undefined) {
    data.zoteroApiKeyEncrypted = encrypt(zoteroApiKey);
  }

  const settings = await db.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  const { zoteroApiKeyEncrypted, ...safeSettings } = settings;

  let maskedKey: string | null = null;
  if (zoteroApiKeyEncrypted) {
    try {
      maskedKey = maskApiKey(decrypt(zoteroApiKeyEncrypted));
    } catch {
      maskedKey = "••••••••(error)";
    }
  }

  return NextResponse.json({ settings: { ...safeSettings, zoteroApiKeyMasked: maskedKey } });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getRequiredUser } from "@/lib/session";

// Returns the decrypted Zotero API key to the authenticated client.
// Never logged, never cached — HTTPS only in production.
export async function GET() {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      zoteroApiKeyEncrypted: true,
      zoteroUserId: true,
      zoteroLibraryType: true,
      zoteroCollectionKey: true,
      zoteroMaybeCollectionKey: true,
    },
  });

  if (!settings?.zoteroApiKeyEncrypted || !settings.zoteroUserId) {
    return NextResponse.json({ configured: false });
  }

  try {
    const apiKey = decrypt(settings.zoteroApiKeyEncrypted);
    return NextResponse.json({
      configured: true,
      apiKey,
      userId: settings.zoteroUserId,
      libraryType: settings.zoteroLibraryType ?? "user",
      collectionKey: settings.zoteroCollectionKey ?? null,
      maybeCollectionKey: settings.zoteroMaybeCollectionKey ?? null,
    });
  } catch {
    return NextResponse.json({ configured: false });
  }
}

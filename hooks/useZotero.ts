"use client";

import { useCallback, useEffect, useState } from "react";
import type { Paper } from "@/app/api/papers/route";

export interface ZoteroSession {
  configured: boolean;
  apiKey?: string;
  userId?: string;
  libraryType?: string;
  collectionKey?: string | null;
  maybeCollectionKey?: string | null;
}

export interface ZoteroCollection {
  key: string;
  name: string;
}

export interface Toast {
  message: string;
  type: "success" | "error";
}

function parseAuthor(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.length > 1 ? (parts.pop() ?? "") : fullName;
  const firstName = parts.join(" ");
  return { creatorType: "author" as const, firstName, lastName };
}

function stripDoiPrefix(doi: string | null): string {
  if (!doi) return "";
  return doi.replace(/^https?:\/\/doi\.org\//i, "");
}

export function useZotero() {
  const [session, setSession] = useState<ZoteroSession | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    fetch("/api/user/zotero-session")
      .then((r) => r.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ configured: false }));
  }, []);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const reloadSession = useCallback(async () => {
    const res = await fetch("/api/user/zotero-session");
    const data = await res.json();
    setSession(data);
  }, []);

  /** Fetch the user's Zotero collections directly from the Zotero API */
  const fetchCollections = useCallback(
    async (userId: string, apiKey: string, libraryType = "user"): Promise<ZoteroCollection[]> => {
      const path = libraryType === "group" ? `groups/${userId}` : `users/${userId}`;
      const res = await fetch(`https://api.zotero.org/${path}/collections?limit=100`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Zotero-API-Version": "3",
        },
      });
      if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
      const data = await res.json();
      return (data as { key: string; data: { name: string } }[]).map((c) => ({
        key: c.key,
        name: c.data.name,
      }));
    },
    []
  );

  const savePaper = useCallback(
    async (paper: Paper, collectionKey: string | null | undefined, apiKey: string, userId: string, libraryType = "user") => {
      if (!collectionKey) return;

      const path = libraryType === "group" ? `groups/${userId}` : `users/${userId}`;
      const url = `https://api.zotero.org/${path}/collections/${collectionKey}/items`;

      const item = {
        itemType: "journalArticle",
        title: paper.title,
        creators: paper.authors.map(parseAuthor),
        DOI: stripDoiPrefix(paper.doi),
        date: paper.year ? String(paper.year) : "",
        publicationTitle: paper.venue ?? "",
        abstractNote: paper.abstract ?? "",
        url: paper.id,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Zotero-API-Version": "3",
        },
        body: JSON.stringify([item]),
      });

      if (!res.ok) {
        throw new Error(`Zotero save failed: ${res.status}`);
      }
    },
    []
  );

  const saveToZotero = useCallback(
    async (paper: Paper) => {
      if (!session?.configured || !session.apiKey || !session.userId) return;
      if (!session.collectionKey) {
        showToast("No ♥ collection set — configure in settings", "error");
        return;
      }
      try {
        await savePaper(paper, session.collectionKey, session.apiKey, session.userId, session.libraryType);
        showToast("Saved to Zotero ✓", "success");
      } catch {
        showToast("Zotero save failed — check your settings", "error");
      }
    },
    [session, savePaper, showToast]
  );

  const saveAsMaybe = useCallback(
    async (paper: Paper) => {
      if (!session?.configured || !session.apiKey || !session.userId) return;
      const key = session.maybeCollectionKey ?? session.collectionKey;
      if (!key) {
        showToast("No collection set — configure in settings", "error");
        return;
      }
      try {
        await savePaper(paper, key, session.apiKey, session.userId, session.libraryType);
        showToast("Saved as Maybe ✓", "success");
      } catch {
        showToast("Zotero save failed — check your settings", "error");
      }
    },
    [session, savePaper, showToast]
  );

  return { session, toast, fetchCollections, saveToZotero, saveAsMaybe, reloadSession };
}

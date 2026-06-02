"use client";

import { useCallback, useEffect, useState } from "react";
import type { Paper } from "@/app/api/papers/route";

export interface MatchData {
  matchId: string;
  otherUser: {
    id: string;
    name: string | null;
    image: string | null;
    orcid: string | null;
  };
  myLikedPaper: { id: string; title: string };
  theirLikedPaper: { id: string; title: string };
}

export function useMatchSave() {
  const [pendingMatch, setPendingMatch] = useState<MatchData | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);

  // Poll for unseen matches on mount (catches matches created while offline)
  useEffect(() => {
    fetch("/api/user/matches")
      .then((r) => r.json())
      .then((data) => {
        if (data.matches?.length > 0) {
          setUnseenCount(data.matches.length);
          setPendingMatch(data.matches[0]);
        }
      })
      .catch(() => {});
  }, []);

  const savePaper = useCallback(async (paper: Paper): Promise<void> => {
    try {
      const res = await fetch("/api/user/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openAlexId: paper.id,
          title: paper.title,
          authorships: paper.authorships,
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.match?.found) {
        setPendingMatch({
          matchId: data.match.matchId,
          otherUser: data.match.otherUser,
          myLikedPaper: data.match.theirPaper,
          theirLikedPaper: data.match.myPaper,
        });
        setUnseenCount((c) => c + 1);
      }
    } catch {}
  }, []);

  const dismissMatch = useCallback(async () => {
    if (!pendingMatch) return;
    try {
      await fetch("/api/user/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: pendingMatch.matchId }),
      });
    } catch {}
    setPendingMatch(null);
    setUnseenCount((c) => Math.max(0, c - 1));
  }, [pendingMatch]);

  return { savePaper, pendingMatch, unseenCount, dismissMatch };
}

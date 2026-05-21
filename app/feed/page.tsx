"use client";

import { useCallback } from "react";
import { usePaperFeed } from "@/hooks/usePaperFeed";
import { useZotero } from "@/hooks/useZotero";
import { CardStack } from "@/components/cards/CardStack";
import { Toast } from "@/components/ui/Toast";
import type { Paper } from "@/app/api/papers/route";

export default function FeedPage() {
  const { papers, loading, error, skip, save, maybe, undo, isEmpty } = usePaperFeed();
  const { saveToZotero, saveAsMaybe, toast } = useZotero();

  const handleSave = useCallback(
    (paper: Paper) => {
      save(paper);
      saveToZotero(paper); // fire-and-forget; toast shown on result
    },
    [save, saveToZotero]
  );

  const handleMaybe = useCallback(
    (paper: Paper) => {
      maybe(paper);
      saveAsMaybe(paper);
    },
    [maybe, saveAsMaybe]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#ff3b7f]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-white/50">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-3xl">🎉</p>
        <p className="font-semibold text-white">You&apos;ve seen everything in your feed.</p>
        <p className="text-sm text-white/40">Adjust your filters or check back later.</p>
        <button
          onClick={() => {
            sessionStorage.removeItem("paperswipe_feed_cache");
            window.location.reload();
          }}
          className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 transition"
        >
          Refresh feed
        </button>
      </div>
    );
  }

  return (
    <>
      <CardStack
        papers={papers}
        onSkip={skip}
        onSave={handleSave}
        onMaybe={handleMaybe}
        onUndo={undo}
      />
      <Toast toast={toast} />
    </>
  );
}

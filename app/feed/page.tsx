"use client";

import { useCallback, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { usePaperFeed } from "@/hooks/usePaperFeed";
import { useZotero } from "@/hooks/useZotero";
import { useMatch } from "@/lib/MatchContext";
import { CardStack } from "@/components/cards/CardStack";
import { Toast } from "@/components/ui/Toast";
import { MatchOverlay } from "@/components/match/MatchOverlay";
import type { Paper } from "@/app/api/papers/route";

export default function FeedPage() {
  const { data: session } = useSession();
  const isGuest = !session;

  const { papers, loading, error, skip, save, maybe, undo, isEmpty } = usePaperFeed();
  const { saveToZotero, saveAsMaybe, toast } = useZotero();
  const { savePaper, pendingMatch, dismissMatch } = useMatch();

  const [guestToast, setGuestToast] = useState<string | null>(null);

  const showGuestPrompt = useCallback(() => {
    setGuestToast("Sign in to save papers to Zotero");
    setTimeout(() => setGuestToast(null), 3500);
  }, []);

  const handleSave = useCallback(
    (paper: Paper) => {
      save(paper);
      if (isGuest) {
        showGuestPrompt();
      } else {
        saveToZotero(paper);
        savePaper(paper); // check for researcher match
      }
    },
    [save, isGuest, showGuestPrompt, saveToZotero, savePaper]
  );

  const handleMaybe = useCallback(
    (paper: Paper) => {
      maybe(paper);
      if (isGuest) showGuestPrompt();
      else saveAsMaybe(paper);
      // Maybe saves don't trigger match detection (only right-swipes / ♥ do)
    },
    [maybe, isGuest, showGuestPrompt, saveAsMaybe]
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
        <p className="text-sm text-white/40">Check back later for new papers.</p>
        {isGuest && (
          <button
            onClick={() => signIn(undefined, { callbackUrl: "/feed" })}
            className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)" }}
          >
            Sign in to customise your feed
          </button>
        )}
        <button
          onClick={() => {
            sessionStorage.removeItem("paperswipe_feed_cache");
            window.location.reload();
          }}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 transition"
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

      {/* Guest save nudge */}
      {guestToast && (
        <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2">
          <button
            onClick={() => signIn(undefined, { callbackUrl: "/feed" })}
            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-xl"
          >
            <span>{guestToast}</span>
            <span className="text-[#ff3b7f]">→</span>
          </button>
        </div>
      )}

      {/* Match overlay */}
      <MatchOverlay
        match={pendingMatch}
        myName={session?.user?.name ?? null}
        myImage={session?.user?.image ?? null}
        onDismiss={dismissMatch}
      />
    </>
  );
}

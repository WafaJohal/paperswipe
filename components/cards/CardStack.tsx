"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";
import { ActionBar } from "./ActionBar";
import { AbstractSheet } from "./AbstractSheet";
import type { Paper } from "@/app/api/papers/route";

interface Props {
  papers: Paper[];
  onSkip: (paper: Paper) => void;
  onSave: (paper: Paper) => void;
  onMaybe: (paper: Paper) => void;
  onUndo: () => void;
}

export function CardStack({ papers, onSkip, onSave, onMaybe, onUndo }: Props) {
  const topCardRef = useRef<SwipeCardHandle>(null);
  const [expandedPaper, setExpandedPaper] = useState<Paper | null>(null);

  const visible = papers.slice(0, 3);
  const top = papers[0];

  const triggerSkip = useCallback(() => {
    topCardRef.current?.swipe("left");
  }, []);

  const triggerSave = useCallback(() => {
    topCardRef.current?.swipe("right");
  }, []);

  const triggerMaybe = useCallback(() => {
    if (!top) return;
    // Maybe uses the same dismiss flow; Zotero "maybe" collection wired in Step 7
    onMaybe(top);
    topCardRef.current?.swipe("right");
  }, [top, onMaybe]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire inside inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
          triggerSkip();
          break;
        case "ArrowRight":
        case "d":
          triggerSave();
          break;
        case "m":
        case "M":
          triggerMaybe();
          break;
        case " ":
          e.preventDefault();
          if (top) setExpandedPaper(top);
          break;
        case "u":
        case "U":
          onUndo();
          break;
        case "Escape":
          setExpandedPaper(null);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [triggerSkip, triggerSave, triggerMaybe, top, onUndo]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Card stack area */}
      <div className="relative flex flex-1 items-start justify-center px-4 pt-4">
        <div
          className="relative w-full max-w-sm"
          style={{ height: "min(520px, calc(100vh - 22rem))" }}
        >
          {visible.map((paper, index) => (
            <SwipeCard
              key={paper.id}
              ref={index === 0 ? topCardRef : undefined}
              paper={paper}
              index={index}
              onSkip={() => top && onSkip(top)}
              onSave={() => top && onSave(top)}
              onExpand={() => setExpandedPaper(paper)}
            />
          ))}
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="hidden text-center text-xs text-white/20 md:block pb-1">
        ← skip · → save · M maybe · Space expand · U undo
      </p>

      {/* Action buttons */}
      <ActionBar
        onSkip={triggerSkip}
        onSave={triggerSave}
        onMaybe={triggerMaybe}
        onUndo={onUndo}
      />

      {/* Abstract bottom sheet */}
      <AbstractSheet
        paper={expandedPaper}
        onClose={() => setExpandedPaper(null)}
        onSave={() => {
          if (top) onSave(top);
        }}
        onSkip={() => {
          if (top) onSkip(top);
        }}
      />
    </div>
  );
}

"use client";

import { forwardRef, useImperativeHandle } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import type { Paper } from "@/app/api/papers/route";

export interface SwipeCardHandle {
  swipe: (direction: "left" | "right") => void;
}

interface Props {
  paper: Paper;
  index: number;
  onSkip: () => void;
  onSave: () => void;
  onExpand: () => void;
}

const THRESHOLD = 120;
const EXIT_X = 700;
const STACK = [
  { scale: 1, y: 0 },
  { scale: 0.95, y: 12 },
  { scale: 0.90, y: 24 },
] as const;

const exitEase: [number, number, number, number] = [0.32, 0, 0.67, 0];

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(
  ({ paper, index, onSkip, onSave, onExpand }, ref) => {
    const isTop = index === 0;
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
    const skipOpacity = useTransform(x, [-THRESHOLD, -30, 0], [1, 0.4, 0]);
    const saveOpacity = useTransform(x, [0, 30, THRESHOLD], [0, 0.4, 1]);

    useImperativeHandle(ref, () => ({
      swipe(direction) {
        const target = direction === "left" ? -EXIT_X : EXIT_X;
        animate(x, target, { duration: 0.35, ease: exitEase }).then(
          direction === "left" ? onSkip : onSave
        );
      },
    }));

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.x < -THRESHOLD) {
        animate(x, -EXIT_X, { duration: 0.35, ease: exitEase }).then(onSkip);
      } else if (info.offset.x > THRESHOLD) {
        animate(x, EXIT_X, { duration: 0.35, ease: exitEase }).then(onSave);
      } else {
        animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
      }
    };

    const { scale, y } = STACK[Math.min(index, 2)];

    return (
      <motion.div
        className="absolute inset-x-0 top-0 touch-none select-none"
        style={{
          x: isTop ? x : 0,
          rotate: isTop ? rotate : 0,
          zIndex: 10 - index,
          cursor: isTop ? "grab" : "default",
        }}
        animate={{ scale, y }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        whileDrag={{ cursor: "grabbing" }}
        onDragEnd={isTop ? handleDragEnd : undefined}
      >
        {/* Tappable inner card */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
          onClick={isTop ? onExpand : undefined}
        >
          {/* Skip overlay */}
          {isTop && (
            <motion.div
              style={{ opacity: skipOpacity }}
              className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-3xl bg-red-500/10 p-5"
            >
              <span className="rotate-12 rounded-xl border-4 border-red-400 px-3 py-1 text-2xl font-black text-red-400">
                SKIP
              </span>
            </motion.div>
          )}

          {/* Save overlay */}
          {isTop && (
            <motion.div
              style={{ opacity: saveOpacity }}
              className="pointer-events-none absolute inset-0 z-10 flex items-start justify-start rounded-3xl bg-green-500/10 p-5"
            >
              <span className="-rotate-12 rounded-xl border-4 border-green-400 px-3 py-1 text-2xl font-black text-green-400">
                SAVE
              </span>
            </motion.div>
          )}

          {/* Content */}
          <div className="space-y-3 p-5">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {paper.isOA && (
                <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                  Open Access
                </span>
              )}
              {paper.citedByCount > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">
                  {paper.citedByCount.toLocaleString()} citations
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="line-clamp-3 text-[1.05rem] font-bold leading-snug text-white">
              {paper.title}
            </h2>

            {/* Authors */}
            <p className="text-sm text-white/60">
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 ? " et al." : ""}
            </p>

            {/* Venue + year */}
            {(paper.venue || paper.year) && (
              <p className="text-xs text-white/40">
                {[paper.venue, paper.year].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* Abstract with fade */}
            {paper.abstract && (
              <div className="relative">
                <p className="line-clamp-4 text-sm leading-relaxed text-white/70">
                  {paper.abstract}
                </p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
              </div>
            )}

            {/* Concept tags */}
            {paper.concepts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {paper.concepts.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/35"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}

            <p className="pt-1 text-center text-xs text-white/20">
              Tap card to expand abstract
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
);

SwipeCard.displayName = "SwipeCard";

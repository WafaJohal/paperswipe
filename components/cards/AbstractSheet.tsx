"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Paper } from "@/app/api/papers/route";

interface Props {
  paper: Paper | null;
  onClose: () => void;
  onSave: () => void;
  onSkip: () => void;
}

export function AbstractSheet({ paper, onClose, onSave, onSkip }: Props) {
  return (
    <AnimatePresence>
      {paper && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#1a1a1a]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-3">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
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
                {paper.year && (
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">
                    {paper.year}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold leading-snug text-white mb-2">
                {paper.title}
              </h2>

              {/* Authors */}
              <p className="text-sm text-white/60 mb-1">
                {paper.authors.slice(0, 5).join(", ")}
                {paper.authors.length > 5 ? " et al." : ""}
              </p>

              {/* Venue */}
              {paper.venue && (
                <p className="text-xs text-white/40 mb-4 italic">{paper.venue}</p>
              )}

              {/* Abstract */}
              {paper.abstract ? (
                <p className="text-sm leading-relaxed text-white/80 mb-5">
                  {paper.abstract}
                </p>
              ) : (
                <p className="text-sm text-white/30 italic mb-5">No abstract available.</p>
              )}

              {/* DOI link */}
              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi.replace("https://doi.org/", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ff3b7f] hover:underline mb-6"
                >
                  View full paper
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { onSkip(); onClose(); }}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 transition"
                >
                  Skip
                </button>
                <button
                  onClick={() => { onSave(); onClose(); }}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white transition"
                  style={{ background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)" }}
                >
                  Save to Zotero ♥
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

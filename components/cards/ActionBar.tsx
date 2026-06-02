"use client";

interface Props {
  onSkip: () => void;
  onSave: () => void;
  onMaybe: () => void;
  onUndo: () => void;
}

export function ActionBar({ onSkip, onSave, onMaybe, onUndo }: Props) {
  return (
    <div className="flex items-center justify-center gap-5 pb-8 pt-4">
      {/* Undo — small */}
      <button
        onClick={onUndo}
        aria-label="Undo"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white/70 active:scale-95"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 14L4 9m0 0l5-5M4 9h11a6 6 0 010 12h-3"
          />
        </svg>
      </button>

      {/* Skip — large red */}
      <button
        onClick={onSkip}
        aria-label="Skip"
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-500/10 text-red-400 shadow-lg transition hover:bg-red-500/20 active:scale-95"
      >
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Save — large green */}
      <button
        onClick={onSave}
        aria-label="Save to Zotero"
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500/50 bg-green-500/10 text-green-400 shadow-lg transition hover:bg-green-500/20 active:scale-95"
      >
        <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </button>

      {/* Maybe — large yellow */}
      <button
        onClick={onMaybe}
        aria-label="Maybe"
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-yellow-500/50 bg-yellow-500/10 text-yellow-400 shadow-lg transition hover:bg-yellow-500/20 active:scale-95"
      >
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

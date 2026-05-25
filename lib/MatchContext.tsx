"use client";

import { createContext, useContext } from "react";
import type { MatchData } from "@/hooks/useMatchSave";

interface MatchContextValue {
  savePaper: (paper: import("@/app/api/papers/route").Paper) => Promise<void>;
  pendingMatch: MatchData | null;
  unseenCount: number;
  dismissMatch: () => Promise<void>;
}

export const MatchContext = createContext<MatchContextValue>({
  savePaper: async () => {},
  pendingMatch: null,
  unseenCount: 0,
  dismissMatch: async () => {},
});

export const useMatch = () => useContext(MatchContext);

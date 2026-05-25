"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { MatchContext } from "@/lib/MatchContext";
import { useMatchSave } from "@/hooks/useMatchSave";

interface Props {
  children: React.ReactNode;
  isGuest: boolean;
}

export function FeedShell({ children, isGuest }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { savePaper, pendingMatch, unseenCount, dismissMatch } = useMatchSave();

  return (
    <MatchContext.Provider value={{ savePaper, pendingMatch, unseenCount, dismissMatch }}>
      <div className="flex h-screen flex-col bg-[#0f0f0f]">
        <TopBar
          isGuest={isGuest}
          unseenMatches={isGuest ? 0 : unseenCount}
          onFilterClick={isGuest ? undefined : () => setSettingsOpen(true)}
        />
        <main className="flex flex-1 flex-col overflow-hidden pt-14">
          {children}
        </main>
        {!isGuest && (
          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onSettingsSaved={() => {
              sessionStorage.removeItem("paperswipe_feed_cache");
            }}
          />
        )}
      </div>
    </MatchContext.Provider>
  );
}

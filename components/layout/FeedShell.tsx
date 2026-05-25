"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

interface Props {
  children: React.ReactNode;
  isGuest: boolean;
}

export function FeedShell({ children, isGuest }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-[#0f0f0f]">
      <TopBar
        isGuest={isGuest}
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
  );
}

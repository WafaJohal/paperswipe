"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export function FeedShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-[#0f0f0f]">
      <TopBar onFilterClick={() => setSettingsOpen(true)} />
      <main className="flex flex-1 flex-col overflow-hidden pt-14">
        {children}
      </main>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsSaved={() => {
          // Clear feed cache so next load reflects new filters
          sessionStorage.removeItem("paperswipe_feed_cache");
        }}
      />
    </div>
  );
}

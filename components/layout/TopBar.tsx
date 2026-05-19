"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";

interface TopBarProps {
  onFilterClick?: () => void;
}

export function TopBar({ onFilterClick }: TopBarProps) {
  const { data: session } = useSession();
  const [avatarError, setAvatarError] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center px-4">
      {/* Blur backdrop */}
      <div className="absolute inset-0 border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-md" />

      <div className="relative z-10 flex w-full items-center justify-between">
        {/* Logo */}
        <span
          className="text-lg font-black tracking-tight"
          style={{
            background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          PaperSwipe
        </span>

        {/* Filter icon — centre */}
        <button
          onClick={onFilterClick}
          aria-label="Open filters"
          className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
          </svg>
        </button>

        {/* Avatar + logout */}
        <div className="flex items-center gap-2">
          {session?.user?.image && !avatarError ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User"}
              width={32}
              height={32}
              className="rounded-full ring-1 ring-white/10"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out"
            className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

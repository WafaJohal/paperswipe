"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#0f0f0f] px-6">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#ff3b7f] opacity-10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-[#ff7b3b] opacity-10 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-6xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            PaperSwipe
          </h1>
          <p className="text-base font-medium text-white/50 tracking-wide">
            Swipe through science.
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => signIn("github", { callbackUrl: "/feed" })}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98]"
          >
            <GitHubIcon className="h-5 w-5 shrink-0 text-white" />
            <span className="flex-1 text-left text-sm font-semibold">
              Continue with GitHub
            </span>
            <svg
              className="h-4 w-4 text-white/30 transition group-hover:text-white/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => signIn("google", { callbackUrl: "/feed" })}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98]"
          >
            <GoogleIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left text-sm font-semibold">
              Continue with Google
            </span>
            <svg
              className="h-4 w-4 text-white/30 transition group-hover:text-white/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-xs text-white/25">or</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          <button
            onClick={() => router.push("/feed")}
            className="rounded-2xl border border-white/8 px-5 py-3.5 text-sm font-medium text-white/40 transition hover:border-white/15 hover:text-white/60 active:scale-[0.98]"
          >
            Continue as guest
          </button>
        </div>

        <p className="text-center text-xs text-white/20 leading-relaxed">
          Sign in to save papers to Zotero and sync your preferences.
          <br />
          Your Zotero key is encrypted at rest and never shared.
        </p>
      </div>
    </main>
  );
}

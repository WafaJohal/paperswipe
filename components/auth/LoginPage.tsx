"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <h1 className="text-5xl font-black tracking-tight gradient-brand-text">
        PaperSwipe
      </h1>
      <p className="text-lg text-white/60">Swipe through science.</p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={() => signIn("github", { callbackUrl: "/feed" })}
          className="flex items-center justify-center gap-3 rounded-2xl bg-white/10 border border-white/10 px-6 py-4 text-white font-semibold hover:bg-white/15 transition"
        >
          Continue with GitHub
        </button>
        <button
          onClick={() => signIn("google", { callbackUrl: "/feed" })}
          className="flex items-center justify-center gap-3 rounded-2xl bg-white/10 border border-white/10 px-6 py-4 text-white font-semibold hover:bg-white/15 transition"
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}

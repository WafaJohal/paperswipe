"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface MatchData {
  matchId: string;
  otherUser: {
    id: string;
    name: string | null;
    image: string | null;
    orcid: string | null;
  };
  myLikedPaper: { id: string; title: string };
  theirLikedPaper: { id: string; title: string };
}

interface Props {
  match: MatchData | null;
  myName: string | null;
  myImage: string | null;
  onDismiss: () => void;
}

export function MatchOverlay({ match, myName, myImage, onDismiss }: Props) {
  const orcidUrl = match?.otherUser.orcid
    ? `https://orcid.org/${match.otherUser.orcid}`
    : null;

  return (
    <AnimatePresence>
      {match && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Background gradient */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background:
                "linear-gradient(160deg, #0f0f0f 0%, #1a0a14 50%, #0f0f1a 100%)",
            }}
          />

          {/* Burst rings */}
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-[#ff3b7f]/20"
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{ width: 600 * i, height: 600 * i, opacity: 0 }}
              transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
            />
          ))}

          <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 text-center">
            {/* Avatars */}
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
                className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-[#ff3b7f]/60 shadow-lg"
              >
                {myImage ? (
                  <Image
                    src={myImage}
                    alt={myName ?? "You"}
                    width={80}
                    height={80}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/10 text-2xl font-bold text-white">
                    {myName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
                className="text-3xl"
              >
                💞
              </motion.div>

              <motion.div
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
                className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-[#ff7b3b]/60 shadow-lg"
              >
                {match.otherUser.image ? (
                  <Image
                    src={match.otherUser.image}
                    alt={match.otherUser.name ?? "Researcher"}
                    width={80}
                    height={80}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/10 text-2xl font-bold text-white">
                    {match.otherUser.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Heading */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2
                className="text-4xl font-black tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                It&apos;s a Match!
              </h2>
              <p className="mt-1 text-sm text-white/50">
                You and{" "}
                <strong className="text-white/80">
                  {match.otherUser.name ?? "a researcher"}
                </strong>{" "}
                liked each other&apos;s work.
              </p>
            </motion.div>

            {/* Papers */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="w-full space-y-2"
            >
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left">
                <p className="text-xs text-white/35 mb-0.5">You liked their paper</p>
                <p className="text-sm font-medium text-white line-clamp-2">
                  {match.myLikedPaper.title}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left">
                <p className="text-xs text-white/35 mb-0.5">They liked your paper</p>
                <p className="text-sm font-medium text-white line-clamp-2">
                  {match.theirLikedPaper.title}
                </p>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex w-full flex-col gap-3"
            >
              {orcidUrl && (
                <a
                  href={orcidUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)",
                  }}
                >
                  View {match.otherUser.name?.split(" ")[0] ?? "their"}&apos;s ORCID
                  profile
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
              <button
                onClick={onDismiss}
                className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-white/60 hover:bg-white/10 transition"
              >
                Keep swiping
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

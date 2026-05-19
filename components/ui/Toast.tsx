"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Toast as ToastType } from "@/hooks/useZotero";

export function Toast({ toast }: { toast: ToastType | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.message + toast.type}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className={`fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500/90 text-white"
          }`}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useNowPlayingActive } from "./NowPlaying";

export default function FloatingUpload() {
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const nowPlayingActive = useNowPlayingActive();

  if (pathname === "/convert" || pathname.startsWith("/player/")) return null;

  return (
    <motion.div
      // Lift above the now-playing bar so it doesn't get covered.
      // `floating-upload` lets Focus Mode (⌘K) dim this button too.
      className={`floating-upload fixed right-6 z-40 transition-[bottom] duration-300 ${
        nowPlayingActive ? "bottom-24" : "bottom-6"
      }`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 200 }}
    >
      <button
        onClick={() => router.push("/convert")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative w-14 h-14 rounded-full bg-gold text-ink flex items-center justify-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] hover:scale-110 active:scale-95 transition-all"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>

        <AnimatePresence>
          {isHovered && (
            <motion.span
              initial={{ opacity: 0, x: 10, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.8 }}
              className="absolute right-full mr-3 px-3 py-1.5 rounded-sm bg-surface-hover border border-hairline-strong text-xs font-medium text-paper whitespace-nowrap"
            >
              Upload a book
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

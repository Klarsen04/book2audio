"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Waveform from "./Waveform";

interface NowPlayingState {
  docId: string;
  title: string;
  isPlaying: boolean;
}

let updateNowPlaying: ((state: NowPlayingState | null) => void) | null = null;

export function setNowPlaying(state: NowPlayingState | null) {
  updateNowPlaying?.(state);
  if (state) {
    sessionStorage.setItem("now_playing", JSON.stringify(state));
  } else {
    sessionStorage.removeItem("now_playing");
  }
}

export default function NowPlayingBar() {
  const [state, setState] = useState<NowPlayingState | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    updateNowPlaying = setState;
    const saved = sessionStorage.getItem("now_playing");
    if (saved) {
      setState(JSON.parse(saved));
    }
    return () => {
      updateNowPlaying = null;
    };
  }, []);

  const isOnPlayerPage = pathname.startsWith("/player/");

  if (!state || isOnPlayerPage) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-white/[0.06]"
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Waveform isPlaying={state.isPlaying} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{state.title}</p>
              <p className="text-xs text-gray-500">
                {state.isPlaying ? "Now playing" : "Paused"}
              </p>
            </div>
          </div>
          <Link
            href={`/player/${state.docId}`}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-xs font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            Open Player
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

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

// Subscribers are notified whenever the now-playing state changes so other
// fixed-position UI (e.g. the floating upload button) can shift out of the way.
const subscribers = new Set<(state: NowPlayingState | null) => void>();

function notify(state: NowPlayingState | null) {
  subscribers.forEach((fn) => fn(state));
}

export function setNowPlaying(state: NowPlayingState | null) {
  if (state) {
    sessionStorage.setItem("now_playing", JSON.stringify(state));
  } else {
    sessionStorage.removeItem("now_playing");
  }
  notify(state);
}

// Reactively tracks whether a now-playing bar is currently active.
export function useNowPlayingActive() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("now_playing");
    setActive(!!saved);
    const fn = (state: NowPlayingState | null) => setActive(!!state);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  return active;
}

export default function NowPlayingBar() {
  const [state, setState] = useState<NowPlayingState | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const saved = sessionStorage.getItem("now_playing");
    if (saved) {
      setState(JSON.parse(saved));
    }
    subscribers.add(setState);
    return () => {
      subscribers.delete(setState);
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-hover border-t border-hairline-strong"
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Waveform isPlaying={state.isPlaying} />
            <div className="min-w-0">
              <p className="text-sm font-serif text-paper truncate">{state.title}</p>
              <p className="label-mono text-paper/40">
                {state.isPlaying ? "Now playing" : "Paused"}
              </p>
            </div>
          </div>
          <Link
            href={`/player/${state.docId}`}
            className="px-4 py-2 rounded-full bg-gold text-ink text-xs font-semibold hover:bg-gold-soft transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            Open Player
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

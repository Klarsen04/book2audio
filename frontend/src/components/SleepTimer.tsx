"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onTimerEnd: () => void;
  onFadeStart: () => void;
}

const PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "60m", minutes: 60 },
];

const FADE_DURATION = 30;

export default function SleepTimer({ onTimerEnd, onFadeStart }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeStarted = useRef(false);

  useEffect(() => {
    if (remaining === null) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onTimerEnd();
          return null;
        }
        if (prev <= FADE_DURATION && !fadeStarted.current) {
          fadeStarted.current = true;
          onFadeStart();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [remaining !== null]);

  const startTimer = (minutes: number) => {
    fadeStarted.current = false;
    setRemaining(minutes * 60);
    setIsOpen(false);
  };

  const cancelTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemaining(null);
    fadeStarted.current = false;
  };

  const formatRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => (remaining ? cancelTimer() : setIsOpen(!isOpen))}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all font-medium ${
          remaining
            ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
            : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
        }`}
        title={remaining ? "Cancel timer" : "Sleep timer"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        {remaining ? formatRemaining(remaining) : "Sleep"}
      </button>

      <AnimatePresence>
        {isOpen && !remaining && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-3 left-0 glass-strong rounded-xl p-3 shadow-2xl"
          >
            <p className="text-xs text-gray-400 mb-2.5 px-1 font-medium">Stop playing after:</p>
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  onClick={() => startTimer(p.minutes)}
                  className="px-3.5 py-2 text-xs bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/[0.1] rounded-lg transition-all font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

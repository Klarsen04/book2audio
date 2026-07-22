"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onTimerEnd?: () => void;
}

type Mode = "focus" | "break";

const PRESETS = {
  pomodoro: { focus: 25, break: 5, label: "Pomodoro (25/5)" },
  long: { focus: 50, break: 10, label: "Deep Focus (50/10)" },
  short: { focus: 15, break: 3, label: "Quick Session (15/3)" },
};

export default function StudyTimer({ onTimerEnd }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(0);
  const [preset, setPreset] = useState<keyof typeof PRESETS>("pomodoro");
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (mode === "focus") {
            setSessions((s) => s + 1);
            setMode("break");
            setRemaining(PRESETS[preset].break * 60);
            onTimerEnd?.();
          } else {
            setMode("focus");
            setRemaining(PRESETS[preset].focus * 60);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remaining, mode, preset, onTimerEnd]);

  const start = (p: keyof typeof PRESETS) => {
    setPreset(p);
    setMode("focus");
    setRemaining(PRESETS[p].focus * 60);
    setIsRunning(true);
    setIsOpen(false);
  };

  const stop = () => {
    setIsRunning(false);
    setRemaining(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = isRunning
    ? 1 - remaining / ((mode === "focus" ? PRESETS[preset].focus : PRESETS[preset].break) * 60)
    : 0;

  return (
    <div className="relative">
      <button
        onClick={() => (isRunning ? stop() : setIsOpen(!isOpen))}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isRunning
            ? mode === "focus"
              ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
              : "bg-amber-600/20 text-amber-300 border border-amber-500/30"
            : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {isRunning ? (
          <span>
            {mode === "focus" ? "Focus" : "Break"} {formatTime(remaining)}
          </span>
        ) : (
          "Study Timer"
        )}
      </button>

      {isRunning && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${mode === "focus" ? "bg-emerald-500" : "bg-amber-500"}`}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      )}

      <AnimatePresence>
        {isOpen && !isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 glass-strong rounded-xl p-4 shadow-2xl w-56 z-50"
          >
            <p className="text-xs font-medium text-gray-300 mb-3">Start a study session</p>
            <div className="space-y-2">
              {(Object.entries(PRESETS) as [keyof typeof PRESETS, typeof PRESETS[keyof typeof PRESETS]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => start(key)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-gray-300"
                >
                  {val.label}
                </button>
              ))}
            </div>
            {sessions > 0 && (
              <p className="text-[10px] text-gray-500 mt-3 text-center">
                {sessions} session{sessions !== 1 ? "s" : ""} completed today
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

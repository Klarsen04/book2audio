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
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(0);
  const [preset, setPreset] = useState<keyof typeof PRESETS>("pomodoro");
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isRunning || isPaused || remaining <= 0) return;

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
  }, [isRunning, isPaused, remaining, mode, preset, onTimerEnd]);

  const start = (p: keyof typeof PRESETS) => {
    setPreset(p);
    setMode("focus");
    setRemaining(PRESETS[p].focus * 60);
    setIsRunning(true);
    setIsPaused(false);
    setIsOpen(false);
  };

  const pause = () => {
    setIsPaused((prev) => !prev);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const reset = () => {
    setIsRunning(false);
    setIsPaused(false);
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
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => (!isRunning ? setIsOpen(!isOpen) : undefined)}
          className={`label-mono flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all ${
            isRunning
              ? mode === "focus"
                ? "bg-gold/10 text-gold border border-gold/30"
                : "bg-surface-hover text-paper/60 border border-hairline-strong"
              : "text-paper/60 hover:text-paper hover:bg-surface-hover"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isRunning ? (
            <span>
              {mode === "focus" ? "Focus" : "Break"} {formatTime(remaining)}
              {isPaused && <span className="ml-1 text-paper/40">(paused)</span>}
            </span>
          ) : (
            "Study Timer"
          )}
        </button>

        {isRunning && (
          <>
            <button
              onClick={pause}
              className={`p-1.5 rounded-sm text-xs transition-all ${
                isPaused
                  ? "bg-gold/10 text-gold hover:bg-gold/20"
                  : "text-paper/60 hover:text-paper hover:bg-surface-hover"
              }`}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>
            <button
              onClick={reset}
              className="p-1.5 rounded-sm text-xs text-paper/60 hover:text-burgundy-soft hover:bg-burgundy/10 transition-all"
              title="Reset timer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>

      {isRunning && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-hairline overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${mode === "focus" ? "bg-gold" : "bg-gold/50"}`}
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
            className="absolute top-full mt-2 left-0 bg-surface-hover border border-hairline-strong rounded-sm p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] w-56 z-50"
          >
            <p className="label-mono text-paper/40 mb-3">Start a study session</p>
            <div className="space-y-2">
              {(Object.entries(PRESETS) as [keyof typeof PRESETS, typeof PRESETS[keyof typeof PRESETS]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => start(key)}
                  className="w-full text-left px-3 py-2 rounded-sm text-sm font-serif bg-surface hover:bg-surface-hover border border-hairline transition-all text-paper/60"
                >
                  {val.label}
                </button>
              ))}
            </div>
            {sessions > 0 && (
              <p className="label-mono text-paper/40 mt-3 text-center">
                {sessions} session{sessions !== 1 ? "s" : ""} completed today
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

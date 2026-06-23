"use client";

import { useState, useEffect, useRef } from "react";

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
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
          remaining ? "bg-purple-900/50 text-purple-300" : "text-gray-400 hover:text-white"
        }`}
        title={remaining ? "Cancel timer" : "Sleep timer"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        {remaining ? formatRemaining(remaining) : "Sleep"}
      </button>

      {isOpen && !remaining && (
        <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg p-2 shadow-xl">
          <p className="text-xs text-gray-400 mb-2 px-1">Stop playing after:</p>
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => startTimer(p.minutes)}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

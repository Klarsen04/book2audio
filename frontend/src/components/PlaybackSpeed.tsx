"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];

interface Props {
  speed: number;
  onChange: (speed: number) => void;
}

export default function PlaybackSpeed({ speed, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

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

  const handleOpen = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Approximate popup box (200px grid + padding/border/label).
      const popupWidth = 226;
      const popupHeight = 170;
      const margin = 8;

      // Flip above the button when there isn't room below.
      const roomBelow = window.innerHeight - rect.bottom;
      const top =
        roomBelow < popupHeight + margin && rect.top > roomBelow
          ? Math.max(margin, rect.top - popupHeight - margin)
          : rect.bottom + margin;

      // Keep the right edge on-screen: never let the popup spill past either side.
      const maxRight = window.innerWidth - popupWidth - margin;
      const right = Math.min(
        Math.max(margin, window.innerWidth - rect.right),
        Math.max(margin, maxRight)
      );

      setPos({ top, right });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        className="label-mono px-3 py-1.5 rounded-sm text-gold hover:bg-surface-hover transition-all"
        title="Playback speed"
      >
        {speed}x
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[100] bg-surface-hover border border-hairline-strong rounded-sm p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]"
            style={{ top: pos.top, right: pos.right }}
          >
            <p className="label-mono text-paper/40 mb-2">Playback Speed</p>
            <div className="grid grid-cols-4 gap-1.5 w-[200px]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setIsOpen(false);
                  }}
                  className={`label-mono px-2 py-1.5 rounded-sm transition-all whitespace-nowrap ${
                    speed === s
                      ? "bg-gold/10 text-gold border border-gold/30"
                      : "bg-surface hover:bg-surface-hover text-paper/60 border border-hairline"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

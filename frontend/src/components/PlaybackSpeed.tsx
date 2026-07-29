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
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all font-semibold"
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
            className="fixed z-[100] bg-[#1a1a1a] border border-white/[0.1] rounded-xl p-3 shadow-2xl"
            style={{ top: pos.top, right: pos.right }}
          >
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Playback Speed</p>
            <div className="grid grid-cols-4 gap-1.5 w-[200px]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setIsOpen(false);
                  }}
                  className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all whitespace-nowrap ${
                    speed === s
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                      : "bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 border border-white/[0.06]"
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

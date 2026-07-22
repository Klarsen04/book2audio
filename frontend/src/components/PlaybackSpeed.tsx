"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

interface Props {
  speed: number;
  onChange: (speed: number) => void;
}

export default function PlaybackSpeed({ speed, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all font-semibold"
        title="Playback speed"
      >
        {speed}x
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-3 right-0 glass-strong rounded-xl p-2.5 shadow-2xl"
          >
            <div className="grid grid-cols-3 gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                    speed === s
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 border border-transparent"
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

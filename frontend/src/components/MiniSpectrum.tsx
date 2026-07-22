"use client";

import { motion } from "framer-motion";

interface Props {
  isPlaying: boolean;
  barCount?: number;
}

export default function MiniSpectrum({ isPlaying, barCount = 12 }: Props) {
  return (
    <div className="flex items-end gap-[2px] h-8 px-1">
      {Array.from({ length: barCount }).map((_, i) => {
        const baseHeight = 3 + Math.sin(i * 0.8) * 2;
        const maxHeight = 8 + Math.random() * 20;
        return (
          <motion.div
            key={i}
            className="w-[2px] rounded-full bg-gradient-to-t from-purple-600 to-blue-400"
            animate={
              isPlaying
                ? {
                    height: [
                      `${baseHeight}px`,
                      `${maxHeight}px`,
                      `${baseHeight + Math.random() * 10}px`,
                      `${maxHeight * 0.7}px`,
                      `${baseHeight}px`,
                    ],
                  }
                : { height: `${baseHeight}px` }
            }
            transition={
              isPlaying
                ? {
                    duration: 0.8 + Math.random() * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.05,
                  }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
}

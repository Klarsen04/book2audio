"use client";

import { motion } from "framer-motion";

interface Props {
  isPlaying: boolean;
}

export default function Waveform({ isPlaying }: Props) {
  const bars = 5;

  return (
    <div className="flex items-end gap-[3px] h-4">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-purple-500 to-blue-400"
          animate={
            isPlaying
              ? {
                  height: ["4px", `${8 + Math.random() * 8}px`, "4px"],
                }
              : { height: "4px" }
          }
          transition={
            isPlaying
              ? {
                  duration: 0.4 + i * 0.1,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: i * 0.08,
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}

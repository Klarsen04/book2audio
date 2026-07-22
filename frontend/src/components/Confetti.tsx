"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
}

let triggerConfetti: (() => void) | null = null;

export function fireConfetti() {
  triggerConfetti?.();
}

export default function ConfettiProvider() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    triggerConfetti = () => {
      const colors = ["#8b5cf6", "#60a5fa", "#34d399", "#f97316", "#ec4899", "#facc15"];
      const newParticles = Array.from({ length: 40 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.3,
        duration: 1.5 + Math.random() * 1.5,
        rotation: Math.random() * 720 - 360,
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 4000);
    };
    return () => { triggerConfetti = null; };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              y: "110vh",
              rotate: p.rotation,
              opacity: [1, 1, 0],
              scale: [1, 1.2, 0.5],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
            className="absolute top-0 w-3 h-3 rounded-sm"
            style={{ backgroundColor: p.color, left: `${p.x}%` }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

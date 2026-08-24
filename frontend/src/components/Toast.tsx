"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastMessage {
  id: string;
  text: string;
}

let addToastFn: ((text: string) => void) | null = null;

export function showToast(text: string) {
  addToastFn?.(text);
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutIds = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    addToastFn = (text: string) => {
      const id = Math.random().toString(36).slice(2);
      // Functional update is safe, but we can guard with isMountedRef to avoid unnecessary work
      setToasts((prev) => [...prev.slice(-2), { id, text }]);
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }
      }, 2000);
      timeoutIds.current.push(timeoutId);
    };
    return () => {
      isMountedRef.current = false;
      // Clear all pending timeouts
      timeoutIds.current.forEach(id => clearTimeout(id));
      timeoutIds.current = [];
      addToastFn = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-2 bg-surface-hover border border-hairline-strong rounded-full text-sm text-paper font-serif shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]"
          >
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

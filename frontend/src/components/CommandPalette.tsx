"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  keywords?: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const isMountedRef = useRef(false);
  const timeoutIds = useRef<NodeJS.Timeout[]>([]);

  const commands: Command[] = [
    { id: "library", label: "Go to Library", icon: "📚", action: () => router.push("/library"), keywords: "home books" },
    { id: "convert", label: "Convert a Book", icon: "📤", action: () => router.push("/convert"), keywords: "upload new" },
    { id: "settings", label: "Settings", icon: "⚙️", action: () => router.push("/settings"), keywords: "preferences config" },
    { id: "speed-up", label: "Increase Speed", icon: "⚡", action: () => {
      const current = parseFloat(localStorage.getItem("playback_speed") || "1");
      const next = Math.min(3, current + 0.25);
      localStorage.setItem("playback_speed", String(next));
      window.dispatchEvent(new CustomEvent("speed-change", { detail: next }));
    }, keywords: "faster" },
    { id: "speed-down", label: "Decrease Speed", icon: "🐌", action: () => {
      const current = parseFloat(localStorage.getItem("playback_speed") || "1");
      const next = Math.max(0.5, current - 0.25);
      localStorage.setItem("playback_speed", String(next));
      window.dispatchEvent(new CustomEvent("speed-change", { detail: next }));
    }, keywords: "slower" },
    { id: "theme-focus", label: "Focus Mode", icon: "🎯", action: () => {
      document.documentElement.classList.toggle("focus-mode");
    }, keywords: "minimal zen" },
  ];

  const filtered = query
    ? commands.filter((c) =>
        `${c.label} ${c.keywords || ""}`.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    isMountedRef.current = true;
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;
    if (isOpen) {
      setQuery("");
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
      timeoutIds.current.push(timeoutId);
    }
    return () => {
      timeoutIds.current.forEach(id => clearTimeout(id));
      timeoutIds.current = [];
    };
  }, [isOpen]);

  const execute = (cmd: Command) => {
    if (!isMountedRef.current) return;
    cmd.action();
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-[200]"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-md z-[201]"
          >
            <div className="bg-surface-hover border border-hairline-strong rounded-sm overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
                <svg className="w-5 h-5 text-paper/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent text-paper text-sm focus:outline-none placeholder-paper/40 font-serif"
                />
                <kbd className="px-2 py-0.5 rounded bg-surface label-mono text-paper/40 border border-hairline">
                  ESC
                </kbd>
              </div>
              <div className="max-h-64 overflow-y-auto py-2">
                {filtered.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => execute(cmd)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gold/10 transition-colors"
                  >
                    <span className="text-lg">{cmd.icon}</span>
                    <span className="text-sm text-paper/60 font-serif">{cmd.label}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-paper/40 font-serif">No commands found</p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

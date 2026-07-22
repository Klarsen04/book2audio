"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Highlight {
  id: string;
  text: string;
  chapterIndex: number;
  color: string;
  note: string;
  createdAt: number;
}

const COLORS = [
  { name: "Yellow", value: "rgba(250, 204, 21, 0.3)", border: "border-yellow-500/40" },
  { name: "Green", value: "rgba(74, 222, 128, 0.3)", border: "border-green-500/40" },
  { name: "Blue", value: "rgba(96, 165, 250, 0.3)", border: "border-blue-500/40" },
  { name: "Purple", value: "rgba(168, 85, 247, 0.3)", border: "border-purple-500/40" },
  { name: "Pink", value: "rgba(244, 114, 182, 0.3)", border: "border-pink-500/40" },
];

interface Props {
  docId: string;
  onHighlightClick?: (highlight: Highlight) => void;
}

export function useHighlights(docId: string) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const storageKey = `highlights_${docId}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setHighlights(JSON.parse(saved));
  }, [storageKey]);

  const save = (updated: Highlight[]) => {
    setHighlights(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const addHighlight = (text: string, chapterIndex: number, color: string = COLORS[0].value) => {
    const h: Highlight = {
      id: Math.random().toString(36).slice(2),
      text,
      chapterIndex,
      color,
      note: "",
      createdAt: Date.now(),
    };
    save([...highlights, h]);
    return h;
  };

  const removeHighlight = (id: string) => {
    save(highlights.filter((h) => h.id !== id));
  };

  const updateNote = (id: string, note: string) => {
    save(highlights.map((h) => (h.id === id ? { ...h, note } : h)));
  };

  return { highlights, addHighlight, removeHighlight, updateNote };
}

export default function HighlightsPanel({ docId, onHighlightClick }: Props) {
  const { highlights, removeHighlight } = useHighlights(docId);
  const [isOpen, setIsOpen] = useState(false);

  if (highlights.length === 0 && !isOpen) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isOpen
            ? "bg-yellow-600/20 text-yellow-300 border border-yellow-500/30"
            : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Highlights
        {highlights.length > 0 && (
          <span className="bg-white/[0.1] px-1.5 rounded-full">{highlights.length}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute top-full mt-2 right-0 w-80 glass-strong rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
              <p className="text-xs font-medium text-gray-300">
                {highlights.length} highlight{highlights.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {highlights.length === 0 ? (
                <p className="p-4 text-xs text-gray-500 text-center">
                  Select text in the reader to highlight it.
                </p>
              ) : (
                highlights.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer group"
                    onClick={() => onHighlightClick?.(h)}
                  >
                    <p
                      className="text-xs text-gray-300 line-clamp-2 rounded px-1"
                      style={{ backgroundColor: h.color }}
                    >
                      {h.text}
                    </p>
                    {h.note && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">{h.note}</p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-600">Ch. {h.chapterIndex + 1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHighlight(h.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { COLORS };

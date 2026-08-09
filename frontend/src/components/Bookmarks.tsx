"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Bookmark {
  id: string;
  time: number;
  label: string;
  createdAt: number;
}

interface Props {
  docId: string;
  currentTime: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Bookmarks({ docId, currentTime, onSeek }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const storageKey = `bookmarks_${docId}`;

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

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setBookmarks(JSON.parse(saved));
    }
  }, [storageKey]);

  const save = (updated: Bookmark[]) => {
    setBookmarks(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const addBookmark = () => {
    const newBookmark: Bookmark = {
      id: Math.random().toString(36).slice(2),
      time: currentTime,
      label: `Bookmark at ${formatTime(currentTime)}`,
      createdAt: Date.now(),
    };
    save([...bookmarks, newBookmark].sort((a, b) => a.time - b.time));
  };

  const removeBookmark = (id: string) => {
    save(bookmarks.filter((b) => b.id !== id));
  };

  const startEdit = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditLabel(bookmark.label);
  };

  const saveEdit = () => {
    if (!editingId) return;
    save(bookmarks.map((b) => (b.id === editingId ? { ...b, label: editLabel } : b)));
    setEditingId(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={addBookmark}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium text-paper/60 hover:text-paper hover:bg-surface-hover transition-all"
          title="Bookmark at current playback position"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="flex flex-col items-start leading-tight gap-0.5">
            <span>Bookmark <span className="label-mono text-gold">{formatTime(currentTime)}</span></span>
            <span className="text-[9px] text-paper/40 font-normal leading-none">at current position</span>
          </span>
        </button>

        {bookmarks.length > 0 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`label-mono px-2.5 py-1.5 rounded-sm transition-all ${
              isOpen
                ? "bg-gold/10 text-gold border border-gold/30"
                : "text-paper/40 hover:text-paper/60 hover:bg-surface"
            }`}
          >
            {bookmarks.length}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && bookmarks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 w-72 bg-surface-hover border border-hairline-strong rounded-sm shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] overflow-hidden z-50"
          >
            <div className="p-3 border-b border-hairline">
              <p className="label-mono text-paper/40">Bookmarks</p>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-hairline">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface transition-colors group"
                >
                  {editingId === bookmark.id ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      autoFocus
                      className="flex-1 text-xs bg-surface border border-hairline-strong rounded-sm px-2 py-1 text-paper focus:outline-none focus:border-gold/40"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => onSeek(bookmark.time)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-xs text-paper/60 truncate">{bookmark.label}</p>
                        <p className="label-mono text-gold">{formatTime(bookmark.time)}</p>
                      </button>
                      <button
                        onClick={() => startEdit(bookmark)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-paper/40 hover:text-paper transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeBookmark(bookmark.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-paper/40 hover:text-burgundy-soft transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

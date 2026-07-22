"use client";

import { useState, useEffect } from "react";
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

  const storageKey = `bookmarks_${docId}`;

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
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={addBookmark}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
          title="Add bookmark at current position"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Bookmark
        </button>

        {bookmarks.length > 0 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isOpen
                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
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
            className="absolute top-full mt-2 left-0 w-72 glass-strong rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-white/[0.06]">
              <p className="text-xs font-medium text-gray-300">Bookmarks</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                >
                  {editingId === bookmark.id ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      autoFocus
                      className="flex-1 text-xs bg-white/[0.06] border border-white/[0.1] rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500/50"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => onSeek(bookmark.time)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-xs text-gray-300 truncate">{bookmark.label}</p>
                        <p className="text-[10px] text-gray-600">{formatTime(bookmark.time)}</p>
                      </button>
                      <button
                        onClick={() => startEdit(bookmark)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeBookmark(bookmark.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
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

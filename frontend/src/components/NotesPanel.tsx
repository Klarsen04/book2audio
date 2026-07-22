"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  docId: string;
}

export default function NotesPanel({ docId }: Props) {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(true);
  const storageKey = `notes_${docId}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setNotes(saved);
  }, [storageKey]);

  const handleChange = (value: string) => {
    setNotes(value);
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, notes);
    setSaved(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!saved && notes) {
        localStorage.setItem(storageKey, notes);
        setSaved(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [notes, saved, storageKey]);

  const handleExport = () => {
    const blob = new Blob([notes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${docId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">Notes</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${saved ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"}`}>
            {saved ? "Saved" : "Unsaved"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-all"
            title="Export as Markdown"
          >
            Export
          </button>
          <button
            onClick={handleSave}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-all"
          >
            Save
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Take notes while listening... Supports markdown formatting."
        className="w-full h-64 p-5 bg-transparent text-gray-300 text-sm leading-relaxed resize-none focus:outline-none placeholder-gray-600"
      />
      <div className="px-5 py-2 border-t border-white/[0.04] flex justify-between text-[10px] text-gray-600">
        <span>{notes.split(/\s+/).filter(Boolean).length} words</span>
        <span>Auto-saves every 2s</span>
      </div>
    </motion.div>
  );
}

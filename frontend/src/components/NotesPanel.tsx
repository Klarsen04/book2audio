"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Props {
  docId: string;
}

export default function NotesPanel({ docId }: Props) {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
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

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  const handleExportMarkdown = () => {
    const blob = new Blob([notes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${docId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportText = () => {
    // Strip basic markdown formatting for plain text
    const plainText = notes
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1");
    const blob = new Blob([plainText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${docId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(notes);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = notes;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
    setShowExportMenu(false);
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
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-all"
              title="Export notes"
            >
              {copyFeedback ? "Copied!" : "Export"}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 glass-strong rounded-xl shadow-2xl border border-white/[0.08] overflow-hidden z-50">
                <button
                  onClick={handleExportMarkdown}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Markdown (.md)
                </button>
                <button
                  onClick={handleExportText}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Plain text (.txt)
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors flex items-center gap-2 border-t border-white/[0.06]"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy to clipboard
                </button>
              </div>
            )}
          </div>
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

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Chapter {
  title: string;
  word_count: number;
  text?: string;
}

interface ReaderSettings {
  fontFamily: "sans-serif" | "serif" | "mono" | "dyslexic";
  fontSize: number;
  lineSpacing: number;
  textWidth: "narrow" | "medium" | "wide";
}

const FONT_FAMILY_MAP: Record<ReaderSettings["fontFamily"], string> = {
  "sans-serif": "Inter, ui-sans-serif, system-ui, sans-serif",
  "serif": "Georgia, ui-serif, serif",
  "mono": "'JetBrains Mono', ui-monospace, monospace",
  "dyslexic": "OpenDyslexic, sans-serif",
};

const TEXT_WIDTH_MAP: Record<ReaderSettings["textWidth"], string> = {
  narrow: "50ch",
  medium: "70ch",
  wide: "90ch",
};

const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: "sans-serif",
  fontSize: 15,
  lineSpacing: 1.8,
  textWidth: "medium",
};

const STORAGE_KEY = "reader_settings";

interface Props {
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterSelect: (index: number) => void;
  onPlayFromText: (chapterIndex: number, textOffset: string) => void;
  isPlaying: boolean;
  chapterProgress?: number;
  searchQuery?: string;
}

export default function ReaderView({
  chapters,
  currentChapterIndex,
  onChapterSelect,
  onPlayFromText,
  isPlaying,
  chapterProgress = 0,
  searchQuery: _searchQuery,
}: Props) {
  const [selectedChapter, setSelectedChapter] = useState(currentChapterIndex);
  const [showToc, setShowToc] = useState(true);
  const [selectedText, setSelectedText] = useState("");
  const [showPlayConfirm, setShowPlayConfirm] = useState(false);
  const [confirmPosition, setConfirmPosition] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const textRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ReaderSettings>;
        setReaderSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }, []);

  // Save settings to localStorage whenever they change
  const updateSettings = useCallback((update: Partial<ReaderSettings>) => {
    setReaderSettings((prev) => {
      const next = { ...prev, ...update };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Close settings panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

  useEffect(() => {
    setSelectedChapter(currentChapterIndex);
    const el = chapterRefs.current[currentChapterIndex];
    if (el && tocRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentChapterIndex]);

  const handleChapterClick = (index: number) => {
    setSelectedChapter(index);
    setShowToc(false);
  };

  const handlePlayChapter = (index: number) => {
    onChapterSelect(index);
  };

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowPlayConfirm(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 5) {
      setShowPlayConfirm(false);
      return;
    }

    setSelectedText(text);

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setConfirmPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setShowPlayConfirm(true);
  };

  const handleConfirmPlay = () => {
    onPlayFromText(selectedChapter, selectedText);
    setShowPlayConfirm(false);
    window.getSelection()?.removeAllRanges();
  };

  const chapter = chapters[selectedChapter];

  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => setShowToc(!showToc)}
          className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="font-medium">Chapters</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-white/[0.04] px-3 py-1 rounded-full">
            {selectedChapter + 1} / {chapters.length}
          </span>
          {/* Settings menu button */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Reader settings"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {/* Settings Panel */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 z-50 w-72 glass-strong rounded-xl shadow-2xl border border-white/[0.08] p-4 space-y-4">
                {/* Font Family */}
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                    Font Family
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["sans-serif", "serif", "mono", "dyslexic"] as const).map((font) => (
                      <button
                        key={font}
                        onClick={() => updateSettings({ fontFamily: font })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                          readerSettings.fontFamily === font
                            ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                            : "bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        {font === "sans-serif" && "Sans-serif"}
                        {font === "serif" && "Serif"}
                        {font === "mono" && "Mono"}
                        {font === "dyslexic" && (
                          <span>
                            Dyslexic
                            <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
                              (better for dyslexia)
                            </span>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                    Font Size <span className="text-gray-500 normal-case">{readerSettings.fontSize}px</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSettings({ fontSize: Math.max(14, readerSettings.fontSize - 1) })}
                      className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 flex items-center justify-center transition-all text-sm font-bold"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={14}
                      max={24}
                      step={1}
                      value={readerSettings.fontSize}
                      onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                      className="flex-1 h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                    />
                    <button
                      onClick={() => updateSettings({ fontSize: Math.min(24, readerSettings.fontSize + 1) })}
                      className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 flex items-center justify-center transition-all text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Line Spacing */}
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                    Line Spacing <span className="text-gray-500 normal-case">{readerSettings.lineSpacing.toFixed(1)}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSettings({ lineSpacing: Math.max(1.4, Math.round((readerSettings.lineSpacing - 0.1) * 10) / 10) })}
                      className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 flex items-center justify-center transition-all text-sm font-bold"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={1.4}
                      max={2.4}
                      step={0.1}
                      value={readerSettings.lineSpacing}
                      onChange={(e) => updateSettings({ lineSpacing: Number(e.target.value) })}
                      className="flex-1 h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                    />
                    <button
                      onClick={() => updateSettings({ lineSpacing: Math.min(2.4, Math.round((readerSettings.lineSpacing + 0.1) * 10) / 10) })}
                      className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 flex items-center justify-center transition-all text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Text Width */}
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                    Text Width
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["narrow", "medium", "wide"] as const).map((width) => (
                      <button
                        key={width}
                        onClick={() => updateSettings({ textWidth: width })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                          readerSettings.textWidth === width
                            ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                            : "bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        {width}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Table of Contents Sidebar */}
        {showToc && (
          <div ref={tocRef} className="w-72 border-r border-white/[0.06] max-h-[500px] overflow-y-auto shrink-0">
            {chapters.map((ch, i) => (
              <div
                key={i}
                ref={(el) => { chapterRefs.current[i] = el; }}
                className={`flex items-center justify-between px-4 py-3.5 cursor-pointer border-b border-white/[0.03] transition-all ${
                  i === selectedChapter
                    ? "bg-purple-500/10 border-l-2 border-l-purple-500"
                    : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                } ${i === currentChapterIndex && isPlaying ? "text-purple-300" : ""}`}
              >
                <div className="flex-1 min-w-0" onClick={() => handleChapterClick(i)}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-gray-600 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className={`text-sm truncate ${i === selectedChapter ? "text-white font-medium" : "text-gray-300"}`}>
                      {ch.title}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 ml-7 mt-0.5">{ch.word_count.toLocaleString()} words</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayChapter(i);
                  }}
                  className="ml-2 p-2 rounded-lg hover:bg-purple-500/20 text-gray-500 hover:text-purple-300 transition-all"
                  title={`Play chapter ${i + 1}`}
                >
                  {i === currentChapterIndex && isPlaying ? (
                    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reader Content */}
        <div className="flex-1 max-h-[500px] overflow-y-auto p-8 relative" id="reader-scroll-container">
          <h3 className="text-xl font-semibold text-white mb-6">{chapter?.title}</h3>

          {chapter?.text ? (
            <div
              ref={textRef}
              onMouseUp={handleTextSelect}
              className="whitespace-pre-wrap select-text cursor-text"
              style={{
                fontFamily: FONT_FAMILY_MAP[readerSettings.fontFamily],
                fontSize: `${readerSettings.fontSize}px`,
                lineHeight: String(readerSettings.lineSpacing),
                maxWidth: TEXT_WIDTH_MAP[readerSettings.textWidth],
              }}
            >
              {chapter.text.split("\n").map((paragraph, i, arr) => {
                const paragraphFraction = arr.length > 0 ? i / arr.length : 0;
                const isActive = isPlaying &&
                  selectedChapter === currentChapterIndex &&
                  Math.abs(paragraphFraction - chapterProgress) < 1 / Math.max(arr.length, 1);
                return (
                  <p
                    key={i}
                    ref={(el) => {
                      if (isActive && el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                    className={`mb-4 transition-colors duration-500 rounded-lg ${
                      isActive ? "text-white bg-purple-500/5 -mx-2 px-2 py-1" : "text-gray-400"
                    }`}
                  >
                    {paragraph}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 italic">Chapter text not available for this document.</p>
          )}

          {/* Play from selection popup */}
          {showPlayConfirm && (
            <div
              className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
              style={{ left: confirmPosition.x, top: confirmPosition.y }}
            >
              <div className="glass-strong rounded-xl shadow-2xl p-2.5 flex items-center gap-2">
                <button
                  onClick={handleConfirmPlay}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play from here
                </button>
                <button
                  onClick={() => {
                    setShowPlayConfirm(false);
                    window.getSelection()?.removeAllRanges();
                  }}
                  className="px-3 py-2 text-gray-400 hover:text-white text-xs transition-colors rounded-lg hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chapter navigation footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
        <button
          onClick={() => setSelectedChapter(Math.max(0, selectedChapter - 1))}
          disabled={selectedChapter === 0}
          className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
        >
          <span className="group-hover:-translate-x-0.5 inline-block transition-transform">←</span> Previous
        </button>
        <button
          onClick={() => handlePlayChapter(selectedChapter)}
          className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-105 active:scale-95"
        >
          Play this chapter
        </button>
        <button
          onClick={() => setSelectedChapter(Math.min(chapters.length - 1, selectedChapter + 1))}
          disabled={selectedChapter === chapters.length - 1}
          className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
        >
          Next <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
        </button>
      </div>
    </div>
  );
}

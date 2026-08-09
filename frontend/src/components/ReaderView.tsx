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
  searchQuery,
}: Props) {
  const [selectedChapter, setSelectedChapter] = useState(currentChapterIndex);
  const [showToc, setShowToc] = useState(true);
  const [selectedText, setSelectedText] = useState("");
  const [showPlayConfirm, setShowPlayConfirm] = useState(false);
  const [confirmPosition, setConfirmPosition] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [matchCount, setMatchCount] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settingsRef = useRef<HTMLDivElement>(null);
  const firstMatchRef = useRef<HTMLElement | null>(null);
  const hasScrolledToMatch = useRef<string>("");
  const lastScrolledParagraphRef = useRef<number>(-1);
  const autoScrollPausedUntilRef = useRef<number>(0);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);

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

  // Pause auto-scroll for 5 seconds when user manually scrolls the reader
  useEffect(() => {
    const container = document.getElementById("reader-scroll-container");
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      // Only treat as user scroll if auto-scroll didn't just fire
      if (Date.now() < autoScrollPausedUntilRef.current) return;
      autoScrollPausedUntilRef.current = Date.now() + 5000;
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  // Auto-scroll to active paragraph only when it changes and user hasn't scrolled recently
  useEffect(() => {
    if (!isPlaying || selectedChapter !== currentChapterIndex) return;
    const currentChapter = chapters[selectedChapter];
    if (!currentChapter?.text) return;

    const paragraphs = currentChapter.text.split("\n");
    let activeIndex = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      const fraction = paragraphs.length > 0 ? i / paragraphs.length : 0;
      if (Math.abs(fraction - chapterProgress) < 1 / Math.max(paragraphs.length, 1)) {
        activeIndex = i;
        break;
      }
    }

    if (activeIndex < 0) return;
    if (activeIndex === lastScrolledParagraphRef.current) return;

    const now = Date.now();
    if (now < autoScrollPausedUntilRef.current) return;

    lastScrolledParagraphRef.current = activeIndex;
    // Temporarily mark as programmatic scroll so the scroll listener ignores it
    autoScrollPausedUntilRef.current = now + 600;

    const el = paragraphRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isPlaying, selectedChapter, currentChapterIndex, chapterProgress, chapters]);

  useEffect(() => {
    setSelectedChapter(currentChapterIndex);
    const el = chapterRefs.current[currentChapterIndex];
    if (el && tocRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentChapterIndex]);

  // Reset scroll-to-match tracking when chapter changes so highlights scroll into view
  useEffect(() => {
    hasScrolledToMatch.current = "";
  }, [selectedChapter]);

  // Count search matches and scroll to first match when query changes
  const chapter = chapters[selectedChapter];
  const [otherChapterMatches, setOtherChapterMatches] = useState<{ index: number; title: string; count: number }[]>([]);

  useEffect(() => {
    if (!searchQuery || !chapter?.text) {
      setMatchCount(0);
      setOtherChapterMatches([]);
      return;
    }
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = chapter.text.match(regex);
    setMatchCount(matches ? matches.length : 0);

    // Scroll to first match when query changes
    if (matches && matches.length > 0 && hasScrolledToMatch.current !== searchQuery) {
      hasScrolledToMatch.current = searchQuery;
      // Small delay to let the DOM render the highlights
      setTimeout(() => {
        if (firstMatchRef.current) {
          firstMatchRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    // If no matches in current chapter, search all other chapters
    if (!matches || matches.length === 0) {
      const otherMatches: { index: number; title: string; count: number }[] = [];
      chapters.forEach((ch, i) => {
        if (i === selectedChapter || !ch.text) return;
        const chRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const chMatches = ch.text.match(chRegex);
        if (chMatches && chMatches.length > 0) {
          otherMatches.push({ index: i, title: ch.title, count: chMatches.length });
        }
      });
      setOtherChapterMatches(otherMatches);
    } else {
      setOtherChapterMatches([]);
    }
  }, [searchQuery, chapter, chapters, selectedChapter]);

  // Helper to render text with search highlights
  const renderHighlightedText = (text: string, isFirstParagraphWithMatch: { value: boolean }) => {
    if (!searchQuery) return text;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    if (parts.length === 1) return text;

    return parts.map((part, idx) => {
      if (regex.test(part)) {
        // Reset regex lastIndex since we use test
        regex.lastIndex = 0;
        const isFirst = isFirstParagraphWithMatch.value;
        isFirstParagraphWithMatch.value = false;
        return (
          <mark
            key={idx}
            ref={isFirst ? (el) => { firstMatchRef.current = el; } : undefined}
            className="bg-gold/30 text-gold rounded-sm px-0.5"
          >
            {part}
          </mark>
        );
      }
      regex.lastIndex = 0;
      return part;
    });
  };

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

  return (
    <div className="bg-surface-hover border border-hairline-strong rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <button
          onClick={() => setShowToc(!showToc)}
          className="label-mono flex items-center gap-2.5 text-paper/60 hover:text-paper transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Chapters</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="label-mono text-gold bg-gold/10 px-3 py-1 rounded-full">
            {selectedChapter + 1} / {chapters.length}
          </span>
          {/* Settings menu button */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-sm text-paper/60 hover:text-paper hover:bg-surface transition-all"
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
              <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-surface-hover rounded-sm shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] border border-hairline-strong p-4 space-y-4">
                {/* Font Family */}
                <div>
                  <label className="label-mono text-paper/40 mb-2 block">
                    Font Family
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["sans-serif", "serif", "mono", "dyslexic"] as const).map((font) => (
                      <button
                        key={font}
                        onClick={() => updateSettings({ fontFamily: font })}
                        className={`px-3 py-2 rounded-sm text-xs font-medium transition-all text-left ${
                          readerSettings.fontFamily === font
                            ? "bg-gold/10 text-gold ring-1 ring-gold/30"
                            : "bg-surface text-paper/60 hover:bg-surface-hover"
                        }`}
                      >
                        {font === "sans-serif" && "Sans-serif"}
                        {font === "serif" && "Serif"}
                        {font === "mono" && "Mono"}
                        {font === "dyslexic" && (
                          <span>
                            Dyslexic
                            <span className="block text-[10px] text-paper/40 font-normal mt-0.5">
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
                  <label className="label-mono text-paper/40 mb-2 block">
                    Font Size <span className="text-paper/40 normal-case">{readerSettings.fontSize}px</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSettings({ fontSize: Math.max(14, readerSettings.fontSize - 1) })}
                      className="w-8 h-8 rounded-sm bg-surface hover:bg-surface-hover text-paper/60 flex items-center justify-center transition-all text-sm font-bold"
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
                      className="flex-1 h-1 bg-hairline rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold"
                    />
                    <button
                      onClick={() => updateSettings({ fontSize: Math.min(24, readerSettings.fontSize + 1) })}
                      className="w-8 h-8 rounded-sm bg-surface hover:bg-surface-hover text-paper/60 flex items-center justify-center transition-all text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Line Spacing */}
                <div>
                  <label className="label-mono text-paper/40 mb-2 block">
                    Line Spacing <span className="text-paper/40 normal-case">{readerSettings.lineSpacing.toFixed(1)}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSettings({ lineSpacing: Math.max(1.4, Math.round((readerSettings.lineSpacing - 0.1) * 10) / 10) })}
                      className="w-8 h-8 rounded-sm bg-surface hover:bg-surface-hover text-paper/60 flex items-center justify-center transition-all text-sm font-bold"
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
                      className="flex-1 h-1 bg-hairline rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold"
                    />
                    <button
                      onClick={() => updateSettings({ lineSpacing: Math.min(2.4, Math.round((readerSettings.lineSpacing + 0.1) * 10) / 10) })}
                      className="w-8 h-8 rounded-sm bg-surface hover:bg-surface-hover text-paper/60 flex items-center justify-center transition-all text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Text Width */}
                <div>
                  <label className="label-mono text-paper/40 mb-2 block">
                    Text Width
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["narrow", "medium", "wide"] as const).map((width) => (
                      <button
                        key={width}
                        onClick={() => updateSettings({ textWidth: width })}
                        className={`px-3 py-2 rounded-sm text-xs font-medium capitalize transition-all ${
                          readerSettings.textWidth === width
                            ? "bg-gold/10 text-gold ring-1 ring-gold/30"
                            : "bg-surface text-paper/60 hover:bg-surface-hover"
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
          <div ref={tocRef} className="w-72 border-r border-hairline max-h-[500px] overflow-y-auto shrink-0 divide-y divide-hairline">
            {chapters.map((ch, i) => (
              <div
                key={i}
                ref={(el) => { chapterRefs.current[i] = el; }}
                className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-all ${
                  i === selectedChapter
                    ? "bg-gold/10 border-l-2 border-l-gold"
                    : "hover:bg-surface border-l-2 border-l-transparent"
                } ${i === currentChapterIndex && isPlaying ? "text-gold" : ""}`}
              >
                <div className="flex-1 min-w-0" onClick={() => handleChapterClick(i)}>
                  <div className="flex items-center gap-2.5">
                    <span className="label-mono text-gold shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className={`font-display text-base truncate ${i === selectedChapter ? "text-gold" : "text-paper/80"}`}>
                      {ch.title}
                    </p>
                  </div>
                  <p className="label-mono text-paper/40 ml-7 mt-0.5">{ch.word_count.toLocaleString()} words</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayChapter(i);
                  }}
                  className="ml-2 p-2 rounded-sm hover:bg-gold/10 text-paper/40 hover:text-gold transition-all"
                  title={`Play chapter ${i + 1}`}
                >
                  {i === currentChapterIndex && isPlaying ? (
                    <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 24 24">
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-2xl text-paper">{chapter?.title}</h3>
            {searchQuery && matchCount > 0 && (
              <span className="label-mono text-gold bg-gold/10 px-2.5 py-1 rounded-full">
                {matchCount} match{matchCount !== 1 ? "es" : ""} found
              </span>
            )}
            {searchQuery && matchCount === 0 && (
              <span className="label-mono text-paper/40 bg-surface px-2.5 py-1 rounded-full">
                No matches in this chapter
              </span>
            )}
          </div>

          {/* Cross-chapter search results */}
          {searchQuery && matchCount === 0 && otherChapterMatches.length > 0 && (
            <div className="mb-6 p-4 rounded-sm bg-gold/5 border border-gold/30">
              <p className="label-mono text-gold mb-2">
                Found in other chapters:
              </p>
              <div className="flex flex-wrap gap-2">
                {otherChapterMatches.map((match) => (
                  <button
                    key={match.index}
                    onClick={() => {
                      setSelectedChapter(match.index);
                      setShowToc(false);
                    }}
                    className="text-xs px-3 py-1.5 rounded-sm bg-gold/10 text-gold hover:bg-gold/20 transition-all"
                  >
                    {match.title} ({match.count} match{match.count !== 1 ? "es" : ""})
                  </button>
                ))}
              </div>
            </div>
          )}

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
              {(() => {
                const isFirstMatch = { value: true };
                return chapter.text.split("\n").map((paragraph, i, arr) => {
                  const paragraphFraction = arr.length > 0 ? i / arr.length : 0;
                  const isActive = isPlaying &&
                    selectedChapter === currentChapterIndex &&
                    Math.abs(paragraphFraction - chapterProgress) < 1 / Math.max(arr.length, 1);

                  return (
                    <p
                      key={i}
                      ref={(el) => { paragraphRefs.current[i] = el; }}
                      className={`mb-4 transition-colors duration-500 rounded-sm ${
                        isActive ? "text-paper bg-gold/5 -mx-2 px-2 py-1" : "text-paper/60"
                      }`}
                    >
                      {renderHighlightedText(paragraph, isFirstMatch)}
                    </p>
                  );
                });
              })()}
            </div>
          ) : (
            <p className="text-paper/40 font-serif italic">Chapter text not available for this document.</p>
          )}

          {/* Play from selection popup */}
          {showPlayConfirm && (
            <div
              className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
              style={{ left: confirmPosition.x, top: confirmPosition.y }}
            >
              <div className="bg-surface-hover border border-hairline-strong rounded-sm shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] p-2.5 flex items-center gap-2">
                <button
                  onClick={handleConfirmPlay}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gold text-ink hover:bg-gold-soft rounded-sm text-xs font-semibold transition-all hover:scale-105 active:scale-95"
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
                  className="px-3 py-2 text-paper/60 hover:text-paper text-xs transition-colors rounded-sm hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chapter navigation footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-hairline">
        <button
          onClick={() => setSelectedChapter(Math.max(0, selectedChapter - 1))}
          disabled={selectedChapter === 0}
          className="label-mono text-paper/60 hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
        >
          <span className="group-hover:-translate-x-0.5 inline-block transition-transform">←</span> Previous
        </button>
        <button
          onClick={() => handlePlayChapter(selectedChapter)}
          className="px-5 py-2 bg-gold text-ink rounded-sm text-sm font-semibold hover:bg-gold-soft transition-all hover:scale-105 active:scale-95"
        >
          Play this chapter
        </button>
        <button
          onClick={() => setSelectedChapter(Math.min(chapters.length - 1, selectedChapter + 1))}
          disabled={selectedChapter === chapters.length - 1}
          className="label-mono text-paper/60 hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
        >
          Next <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

interface Chapter {
  title: string;
  word_count: number;
  text?: string;
}

interface Props {
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterSelect: (index: number) => void;
  onPlayFromText: (chapterIndex: number, textOffset: string) => void;
  isPlaying: boolean;
  chapterProgress?: number;
}

export default function ReaderView({
  chapters,
  currentChapterIndex,
  onChapterSelect,
  onPlayFromText,
  isPlaying,
  chapterProgress = 0,
}: Props) {
  const [selectedChapter, setSelectedChapter] = useState(currentChapterIndex);
  const [showToc, setShowToc] = useState(true);
  const [selectedText, setSelectedText] = useState("");
  const [showPlayConfirm, setShowPlayConfirm] = useState(false);
  const [confirmPosition, setConfirmPosition] = useState({ x: 0, y: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);

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
        <span className="text-xs text-gray-500 bg-white/[0.04] px-3 py-1 rounded-full">
          {selectedChapter + 1} / {chapters.length}
        </span>
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
              className="text-[15px] leading-[1.8] whitespace-pre-wrap select-text cursor-text"
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

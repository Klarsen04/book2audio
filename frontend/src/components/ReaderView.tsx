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
}

export default function ReaderView({
  chapters,
  currentChapterIndex,
  onChapterSelect,
  onPlayFromText,
  isPlaying,
}: Props) {
  const [selectedChapter, setSelectedChapter] = useState(currentChapterIndex);
  const [showToc, setShowToc] = useState(true);
  const [selectedText, setSelectedText] = useState("");
  const [showPlayConfirm, setShowPlayConfirm] = useState(false);
  const [confirmPosition, setConfirmPosition] = useState({ x: 0, y: 0 });
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedChapter(currentChapterIndex);
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
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => setShowToc(!showToc)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Chapters
        </button>
        <span className="text-xs text-gray-500">
          Chapter {selectedChapter + 1} of {chapters.length}
        </span>
      </div>

      <div className="flex">
        {/* Table of Contents Sidebar */}
        {showToc && (
          <div className="w-64 border-r border-gray-800 max-h-[500px] overflow-y-auto shrink-0">
            {chapters.map((ch, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-gray-800/50 transition-colors ${
                  i === selectedChapter
                    ? "bg-purple-900/30 border-l-2 border-l-purple-500"
                    : "hover:bg-gray-800/50"
                } ${i === currentChapterIndex && isPlaying ? "text-purple-300" : ""}`}
              >
                <div className="flex-1 min-w-0" onClick={() => handleChapterClick(i)}>
                  <p className={`text-sm truncate ${i === selectedChapter ? "text-white" : "text-gray-300"}`}>
                    {ch.title}
                  </p>
                  <p className="text-xs text-gray-500">{ch.word_count.toLocaleString()} words</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayChapter(i);
                  }}
                  className="ml-2 p-1.5 rounded-full hover:bg-purple-600/30 text-gray-500 hover:text-purple-300 transition-colors"
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
        <div className="flex-1 max-h-[500px] overflow-y-auto p-6 relative">
          <h3 className="text-lg font-semibold text-white mb-4">{chapter?.title}</h3>

          {chapter?.text ? (
            <div
              ref={textRef}
              onMouseUp={handleTextSelect}
              className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap select-text cursor-text"
            >
              {chapter.text.split("\n").map((paragraph, i) => (
                <p key={i} className="mb-3">
                  {paragraph}
                </p>
              ))}
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
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 flex items-center gap-2">
                <button
                  onClick={handleConfirmPlay}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium transition-colors"
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
                  className="px-2 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chapter navigation footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
        <button
          onClick={() => setSelectedChapter(Math.max(0, selectedChapter - 1))}
          disabled={selectedChapter === 0}
          className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>
        <button
          onClick={() => handlePlayChapter(selectedChapter)}
          className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-medium hover:from-purple-500 hover:to-blue-500 transition-all"
        >
          Play this chapter
        </button>
        <button
          onClick={() => setSelectedChapter(Math.min(chapters.length - 1, selectedChapter + 1))}
          disabled={selectedChapter === chapters.length - 1}
          className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

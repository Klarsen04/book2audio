"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import AudioPlayer from "@/components/AudioPlayer";
import ReaderView from "@/components/ReaderView";
import Bookmarks from "@/components/Bookmarks";
import StudyTimer from "@/components/StudyTimer";
import HighlightsPanel from "@/components/Highlights";
import NotesPanel from "@/components/NotesPanel";
import { setNowPlaying } from "@/components/NowPlaying";
import { motion } from "framer-motion";

interface Chapter {
  title: string;
  word_count: number;
  text?: string;
  start_time?: number;
}

interface Document {
  id: string;
  title: string;
  filename: string;
  chapters: Chapter[];
  audio_duration: number | null;
  status: string;
}

export default function PlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const docId = params.docId as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"reader" | "notes" | "none">("reader");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    api
      .get(`/api/library/${docId}`)
      .then((res) => {
        setDocument(res.data.document);
        const t = searchParams.get("t");
        if (t) {
          setSeekTarget(parseInt(t, 10));
        }
      })
      .catch(() => setError("Document not found"))
      .finally(() => setLoading(false));
  }, [docId, searchParams]);

  const handleChapterSelect = (index: number) => {
    if (!document) return;
    const chapter = document.chapters[index];

    let seekTime: number;
    if (chapter.start_time !== undefined) {
      seekTime = chapter.start_time;
    } else {
      const chapters = document.chapters;
      const totalWords = chapters.reduce((sum, ch) => sum + ch.word_count, 0);
      const wordsBeforeChapter = chapters.slice(0, index).reduce((sum, ch) => sum + ch.word_count, 0);
      seekTime = (wordsBeforeChapter / totalWords) * (document.audio_duration || 0);
    }

    setSeekTarget(seekTime);
    setCurrentChapterIndex(index);
  };

  const handlePlayFromText = (chapterIndex: number, selectedText: string) => {
    if (!document) return;
    const chapters = document.chapters;
    const chapter = chapters[chapterIndex];

    const chapterStart = chapter.start_time !== undefined
      ? chapter.start_time
      : (chapters.slice(0, chapterIndex).reduce((s, c) => s + c.word_count, 0) / chapters.reduce((s, c) => s + c.word_count, 0)) * (document.audio_duration || 0);

    const nextChapter = chapters[chapterIndex + 1];
    const chapterEnd = nextChapter?.start_time !== undefined
      ? nextChapter.start_time
      : document.audio_duration || 0;

    const chapterDuration = chapterEnd - chapterStart;

    if (chapter.text) {
      const textPosition = chapter.text.indexOf(selectedText);
      if (textPosition !== -1) {
        const chapterTextBefore = chapter.text.substring(0, textPosition);
        const fractionInChapter = chapterTextBefore.split(/\s+/).length / Math.max(chapter.word_count, 1);
        const seekTime = chapterStart + fractionInChapter * chapterDuration;
        setSeekTarget(seekTime);
        setCurrentChapterIndex(chapterIndex);
        return;
      }
    }

    setSeekTarget(chapterStart);
    setCurrentChapterIndex(chapterIndex);
  };

  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time);
      if (!document) return;
      const currentTime = time;
      const chapters = document.chapters;
      const hasTimestamps = chapters[0]?.start_time !== undefined;

      if (hasTimestamps) {
        let activeIndex = 0;
        for (let i = 0; i < chapters.length; i++) {
          if ((chapters[i].start_time ?? 0) <= currentTime) {
            activeIndex = i;
          } else {
            break;
          }
        }
        if (activeIndex !== currentChapterIndex) setCurrentChapterIndex(activeIndex);
      } else {
        if (!document.audio_duration) return;
        const fraction = currentTime / document.audio_duration;
        const totalWords = chapters.reduce((sum, ch) => sum + ch.word_count, 0);
        let wordsSoFar = 0;
        for (let i = 0; i < chapters.length; i++) {
          wordsSoFar += chapters[i].word_count;
          if (wordsSoFar / totalWords >= fraction) {
            if (i !== currentChapterIndex) setCurrentChapterIndex(i);
            break;
          }
        }
      }
    },
    [document, currentChapterIndex]
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        <div className="glass rounded-2xl h-48 animate-pulse" />
        <div className="glass rounded-2xl h-96 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-red-300 mb-4">{error}</p>
        <Link href="/library" className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
          ← Back to library
        </Link>
      </div>
    );
  }

  if (!document) return null;

  if (document.status !== "completed") {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">⏳</div>
        <p className="text-gray-400 mb-4">This document hasn&apos;t been converted yet.</p>
        <Link href="/library" className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
          ← Back to library
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="flex items-center justify-between">
        <Link
          href="/library"
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Back to library
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <StudyTimer />
          <Bookmarks
            docId={docId}
            currentTime={currentTime}
            onSeek={(time) => setSeekTarget(time)}
          />
          <HighlightsPanel docId={docId} />
          <button
            onClick={() => {
              const url = `${window.location.origin}/player/${docId}?t=${Math.floor(currentTime)}`;
              navigator.clipboard.writeText(url);
              import("@/components/Toast").then(({ showToast }) => showToast("Link copied!"));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
            title="Copy link with timestamp"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
            {(["reader", "notes", "none"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${
                  activeTab === tab
                    ? "bg-purple-600/20 text-purple-300"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "none" ? "Minimal" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AudioPlayer
        docId={docId}
        title={document.title}
        chapters={document.chapters}
        seekTarget={seekTarget}
        onSeekHandled={() => setSeekTarget(null)}
        onPlayingChange={(playing) => {
          setIsPlaying(playing);
          setNowPlaying({ docId, title: document.title, isPlaying: playing });
        }}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Chapter progress mini-map */}
      {document.chapters.length > 1 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-1">
            {document.chapters.map((ch, i) => {
              const isComplete = i < currentChapterIndex;
              const isCurrent = i === currentChapterIndex;
              const progress = isCurrent
                ? (() => {
                    if (!document.audio_duration) return 0;
                    const chStart = ch.start_time ?? 0;
                    const chEnd = document.chapters[i + 1]?.start_time ?? document.audio_duration;
                    const chDuration = chEnd - chStart;
                    return chDuration > 0 ? ((currentTime - chStart) / chDuration) * 100 : 0;
                  })()
                : isComplete ? 100 : 0;
              return (
                <button
                  key={i}
                  onClick={() => handleChapterSelect(i)}
                  className="flex-1 group relative"
                  title={ch.title}
                >
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isComplete ? "bg-emerald-500/60" : isCurrent ? "bg-gradient-to-r from-purple-500 to-blue-500" : ""
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 glass-strong rounded text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {ch.title}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-gray-600">Ch. 1</span>
            <span className="text-[10px] text-gray-500 font-medium">
              Chapter {currentChapterIndex + 1} of {document.chapters.length}
            </span>
            <span className="text-[10px] text-gray-600">Ch. {document.chapters.length}</span>
          </div>
        </div>
      )}

      {activeTab === "reader" && (
        <motion.div
          key="reader"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ReaderView
            chapters={document.chapters}
            currentChapterIndex={currentChapterIndex}
            onChapterSelect={handleChapterSelect}
            onPlayFromText={handlePlayFromText}
            isPlaying={isPlaying}
            chapterProgress={(() => {
              if (!document.audio_duration) return 0;
              const ch = document.chapters;
              const chStart = ch[currentChapterIndex]?.start_time ?? 0;
              const chEnd = ch[currentChapterIndex + 1]?.start_time ?? document.audio_duration;
              const chDuration = chEnd - chStart;
              return chDuration > 0 ? (currentTime - chStart) / chDuration : 0;
            })()}
          />
        </motion.div>
      )}

      {activeTab === "notes" && (
        <motion.div
          key="notes"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <NotesPanel docId={docId} />
        </motion.div>
      )}
    </motion.div>
  );
}

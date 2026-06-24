"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import AudioPlayer from "@/components/AudioPlayer";
import ReaderView from "@/components/ReaderView";

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
  const docId = params.docId as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [showReader, setShowReader] = useState(true);

  useEffect(() => {
    api
      .get(`/api/library/${docId}`)
      .then((res) => setDocument(res.data.document))
      .catch(() => setError("Document not found"))
      .finally(() => setLoading(false));
  }, [docId]);

  const handleChapterSelect = (index: number) => {
    if (!document) return;
    const chapter = document.chapters[index];

    let seekTime: number;
    if (chapter.start_time !== undefined) {
      // Use exact timestamp recorded during conversion
      seekTime = chapter.start_time;
    } else {
      // Fallback: estimate from word counts
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

    // Get chapter start and end times
    const chapterStart = chapter.start_time !== undefined
      ? chapter.start_time
      : (chapters.slice(0, chapterIndex).reduce((s, c) => s + c.word_count, 0) / chapters.reduce((s, c) => s + c.word_count, 0)) * (document.audio_duration || 0);

    const nextChapter = chapters[chapterIndex + 1];
    const chapterEnd = nextChapter?.start_time !== undefined
      ? nextChapter.start_time
      : document.audio_duration || 0;

    const chapterDuration = chapterEnd - chapterStart;

    // Find where in the chapter text the selection is
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

    // Fallback: just play from chapter start
    setSeekTarget(chapterStart);
    setCurrentChapterIndex(chapterIndex);
  };

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (!document) return;
      const chapters = document.chapters;
      const hasTimestamps = chapters[0]?.start_time !== undefined;

      if (hasTimestamps) {
        // Use exact timestamps — find last chapter whose start_time <= currentTime
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
        // Fallback: word count estimate
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

  if (loading) return <p className="text-gray-400 text-center py-12">Loading...</p>;
  if (error) return <p className="text-red-400 text-center py-12">{error}</p>;
  if (!document) return null;

  if (document.status !== "completed") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">This document hasn&apos;t been converted yet.</p>
        <Link href="/library" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/library" className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
          ← Back to library
        </Link>
        <button
          onClick={() => setShowReader(!showReader)}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${
            showReader ? "bg-purple-600/30 text-purple-300" : "text-gray-400 hover:text-white"
          }`}
        >
          {showReader ? "Hide Reader" : "Show Reader"}
        </button>
      </div>

      <AudioPlayer
        docId={docId}
        title={document.title}
        chapters={document.chapters}
        seekTarget={seekTarget}
        onSeekHandled={() => setSeekTarget(null)}
        onPlayingChange={setIsPlaying}
        onTimeUpdate={handleTimeUpdate}
      />

      {showReader && (
        <ReaderView
          chapters={document.chapters}
          currentChapterIndex={currentChapterIndex}
          onChapterSelect={handleChapterSelect}
          onPlayFromText={handlePlayFromText}
          isPlaying={isPlaying}
        />
      )}
    </div>
  );
}

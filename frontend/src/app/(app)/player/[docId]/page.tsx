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
    const chapters = document.chapters;
    const totalWords = chapters.reduce((sum, ch) => sum + ch.word_count, 0);
    const wordsBeforeChapter = chapters.slice(0, index).reduce((sum, ch) => sum + ch.word_count, 0);
    const fraction = wordsBeforeChapter / totalWords;
    const duration = document.audio_duration || 0;
    const seekTime = fraction * duration;
    setSeekTarget(seekTime);
    setCurrentChapterIndex(index);
  };

  const handlePlayFromText = (chapterIndex: number, selectedText: string) => {
    if (!document) return;
    const chapters = document.chapters;
    const chapter = chapters[chapterIndex];
    if (!chapter.text) return;

    const textPosition = chapter.text.indexOf(selectedText);
    if (textPosition === -1) {
      handleChapterSelect(chapterIndex);
      return;
    }

    const totalWords = chapters.reduce((sum, ch) => sum + ch.word_count, 0);
    const wordsBeforeChapter = chapters.slice(0, chapterIndex).reduce((sum, ch) => sum + ch.word_count, 0);
    const chapterTextBefore = chapter.text.substring(0, textPosition);
    const wordsInChapterBefore = chapterTextBefore.split(/\s+/).length;
    const fractionInChapter = wordsInChapterBefore / chapter.word_count;
    const chapterDurationFraction = chapter.word_count / totalWords;
    const overallFraction = (wordsBeforeChapter / totalWords) + (fractionInChapter * chapterDurationFraction);

    const duration = document.audio_duration || 0;
    const seekTime = overallFraction * duration;
    setSeekTarget(seekTime);
    setCurrentChapterIndex(chapterIndex);
  };

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (!document || !document.audio_duration) return;
      const duration = document.audio_duration;
      const fraction = currentTime / duration;
      const totalWords = document.chapters.reduce((sum, ch) => sum + ch.word_count, 0);
      let wordsSoFar = 0;
      for (let i = 0; i < document.chapters.length; i++) {
        wordsSoFar += document.chapters[i].word_count;
        if (wordsSoFar / totalWords >= fraction) {
          if (i !== currentChapterIndex) {
            setCurrentChapterIndex(i);
          }
          break;
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

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import AudioPlayer from "@/components/AudioPlayer";
import ReaderView from "@/components/ReaderView";
import Bookmarks from "@/components/Bookmarks";
import StudyTimer from "@/components/StudyTimer";
import HighlightsPanel, { addHighlightForDoc } from "@/components/Highlights";
import NotesPanel from "@/components/NotesPanel";
import FlashcardsView from "@/components/Flashcards";
import { setNowPlaying } from "@/components/NowPlaying";
import { showToast } from "@/components/Toast";
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

interface LibraryDoc {
  id: string;
  title: string;
  status: string;
  part_group?: string | null;
  part_index?: number | null;
}

export default function PlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = params.docId as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [autoPlayAfterSeek, setAutoPlayAfterSeek] = useState(false);
  const [activeTab, setActiveTab] = useState<"reader" | "notes" | "flashcards" | "none">("reader");
  const [currentTime, setCurrentTime] = useState(0);
  const [autoplayNext, setAutoplayNext] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryDocs, setLibraryDocs] = useState<LibraryDoc[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("autoplay_next");
    if (stored === "true") setAutoplayNext(true);
  }, []);

  // Feed the library's "Recently played" sort.
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("last_played") || "{}");
      const map = parsed && typeof parsed === "object" ? parsed : {};
      map[docId] = Date.now();
      localStorage.setItem("last_played", JSON.stringify(map));
    } catch {}
  }, [docId]);

  const libraryDocsRef = useRef<LibraryDoc[]>([]);
  useEffect(() => {
    libraryDocsRef.current = libraryDocs;
  }, [libraryDocs]);

  // Re-fetched on focus and before autoplay decisions so a sibling part that
  // finished converting while we listened becomes navigable without a reload.
  const refreshLibrary = useCallback(async (): Promise<LibraryDoc[]> => {
    try {
      const res = await api.get("/api/library");
      const docs = res.data.documents || res.data || [];
      setLibraryDocs(docs);
      return docs;
    } catch {
      return libraryDocsRef.current;
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
    const onFocus = () => refreshLibrary();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshLibrary]);

  const findNextCompletedDoc = useCallback(
    (docs: LibraryDoc[]): LibraryDoc | null => {
      if (docs.length === 0) return null;
      const current = docs.find((doc) => doc.id === docId);

      // If this is part of a split book, the next item is the next part in
      // sequence — never an earlier part. Only offer it once it's ready.
      if (current?.part_group && current.part_index != null) {
        const nextPart = docs.find(
          (d) => d.part_group === current.part_group && d.part_index === current.part_index! + 1
        );
        if (nextPart) return nextPart.status === "completed" ? nextPart : null;
        return null; // last part of the book
      }

      // Otherwise, the next completed doc in the list.
      const currentIndex = docs.findIndex((doc) => doc.id === docId);
      if (currentIndex === -1) return null;
      for (let i = currentIndex + 1; i < docs.length; i++) {
        if (docs[i].status === "completed") {
          return docs[i];
        }
      }
      return null;
    },
    [docId]
  );

  const getNextCompletedDoc = useCallback(
    (): LibraryDoc | null => findNextCompletedDoc(libraryDocs),
    [findNextCompletedDoc, libraryDocs]
  );

  const toggleAutoplay = () => {
    setAutoplayNext((prev) => {
      const next = !prev;
      localStorage.setItem("autoplay_next", String(next));
      return next;
    });
  };

  const handleAudioEnded = useCallback(async () => {
    if (autoplayNext) {
      // Refresh first — a next part may have finished while we listened.
      const docs = await refreshLibrary();
      const nextDoc = findNextCompletedDoc(docs);
      if (nextDoc) {
        showToast(`Playing next: ${nextDoc.title}`);
        router.push(`/player/${nextDoc.id}`);
      } else {
        showToast("End of queue");
      }
    }
  }, [autoplayNext, refreshLibrary, findNextCompletedDoc, router]);

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

  // If the doc isn't converted yet, watch its status so the page comes alive
  // the moment conversion finishes (instead of a dead "not converted" wall).
  const [liveStatus, setLiveStatus] = useState<{ status: string; progress: number } | null>(null);
  useEffect(() => {
    if (!document || document.status === "completed") return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/status/${docId}`);
        setLiveStatus({ status: res.data.status, progress: res.data.progress ?? 0 });
        if (res.data.status === "completed") {
          clearInterval(interval);
          const doc = await api.get(`/api/library/${docId}`);
          setDocument(doc.data.document);
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [document, docId]);

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
    setAutoPlayAfterSeek(true);
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
        <div className="h-6 w-32 bg-surface rounded-sm animate-pulse" />
        <div className="bg-surface border border-hairline rounded-sm h-48 animate-pulse" />
        <div className="bg-surface border border-hairline rounded-sm h-96 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-burgundy-soft mb-4">{error}</p>
        <Link href="/library" className="text-gold hover:text-gold-soft text-sm font-medium transition-colors">
          ← Back to library
        </Link>
      </div>
    );
  }

  if (!document) return null;

  if (document.status !== "completed") {
    const status = liveStatus?.status ?? document.status;
    const inProgress = status === "converting" || status === "queued";
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">{status === "error" ? "😕" : "⏳"}</div>
        {inProgress ? (
          <>
            <p className="text-paper/60 mb-2">
              {status === "queued"
                ? "This document is queued for conversion — it starts automatically."
                : `Converting… ${liveStatus?.progress ?? 0}%`}
            </p>
            <p className="label-mono text-paper/40 mb-6">The player opens by itself when it&apos;s ready.</p>
          </>
        ) : status === "error" ? (
          <p className="text-paper/60 mb-6">The conversion failed — you can retry it.</p>
        ) : (
          <p className="text-paper/60 mb-6">This document hasn&apos;t been converted yet.</p>
        )}
        <div className="flex items-center justify-center gap-4">
          {!inProgress && (
            <Link
              href={`/convert?doc=${docId}`}
              className="label-mono px-6 py-2.5 rounded-full bg-gold text-ink hover:scale-[1.02] transition-all"
            >
              {status === "error" ? "Retry conversion" : "Convert now"}
            </Link>
          )}
          <Link href="/library" className="text-gold hover:text-gold-soft text-sm font-medium transition-colors">
            ← Back to library
          </Link>
        </div>
      </div>
    );
  }

  // If this audiobook is one part of an auto-split book, gather its siblings
  // (ordered by part number) so we can show a Part X-of-N navigator.
  const currentLibDoc = libraryDocs.find((d) => d.id === docId);
  const bookParts = currentLibDoc?.part_group
    ? libraryDocs
        .filter((d) => d.part_group === currentLibDoc.part_group)
        .sort((a, b) => (a.part_index ?? 0) - (b.part_index ?? 0))
    : [];
  const currentPartIndex = currentLibDoc?.part_index ?? null;
  const prevPart = bookParts.find((p) => (p.part_index ?? 0) === (currentPartIndex ?? 0) - 1);
  const nextPart = bookParts.find((p) => (p.part_index ?? 0) === (currentPartIndex ?? 0) + 1);

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
          className="label-mono text-paper/60 hover:text-paper transition-colors flex items-center gap-1.5 group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Back to library
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleAutoplay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-all ${
              autoplayNext
                ? "text-gold bg-gold/10 border border-gold/30"
                : "text-paper/60 hover:text-paper hover:bg-surface-hover"
            }`}
            title="Auto-play next document when audio ends"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Auto-play next
          </button>
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
              showToast("Link copied!");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium text-paper/60 hover:text-paper hover:bg-surface-hover transition-all"
            title="Copy link with timestamp"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <div className="flex items-center gap-1 bg-surface rounded-sm p-1 border border-hairline">
            {(["reader", "notes", "flashcards", "none"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`label-mono px-3 py-1.5 rounded-sm transition-all ${
                  activeTab === tab
                    ? "bg-gold/10 text-gold"
                    : "text-paper/40 hover:text-paper/60"
                }`}
              >
                {tab === "none" ? "Minimal" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bookParts.length > 1 && (
        <div className="bg-surface border border-hairline rounded-sm p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <span className="label-mono text-paper/70">
              Part {currentPartIndex} of {bookParts.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={!prevPart || prevPart.status !== "completed"}
                onClick={() => prevPart && router.push(`/player/${prevPart.id}`)}
                className="label-mono px-3 py-1.5 rounded-sm border border-hairline text-paper/60 hover:text-paper hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button
                disabled={!nextPart || nextPart.status !== "completed"}
                onClick={() => nextPart && router.push(`/player/${nextPart.id}`)}
                className="label-mono px-3 py-1.5 rounded-sm border border-hairline text-paper/60 hover:text-paper hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={nextPart && nextPart.status !== "completed" ? `Part ${nextPart.part_index} is ${nextPart.status}` : undefined}
              >
                Next part →
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bookParts.map((p) => {
              const isCurrent = p.id === docId;
              const done = p.status === "completed";
              return (
                <button
                  key={p.id}
                  disabled={!isCurrent && !done}
                  onClick={() => !isCurrent && done && router.push(`/player/${p.id}`)}
                  title={`Part ${p.part_index}${done ? "" : ` — ${p.status}`}`}
                  className={`label-mono w-8 h-8 rounded-sm flex items-center justify-center transition-all ${
                    isCurrent
                      ? "bg-gold text-ink"
                      : done
                      ? "border border-hairline text-paper/70 hover:bg-surface-hover hover:text-paper"
                      : p.status === "error"
                      ? "border border-burgundy/30 text-burgundy-soft/60 cursor-not-allowed"
                      : "border border-hairline text-paper/30 cursor-not-allowed"
                  }`}
                >
                  {p.part_index}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AudioPlayer
        docId={docId}
        title={document.title}
        chapters={document.chapters}
        seekTarget={seekTarget}
        autoPlay={autoPlayAfterSeek}
        onSeekHandled={() => { setSeekTarget(null); setAutoPlayAfterSeek(false); }}
        onPlayingChange={(playing) => {
          setIsPlaying(playing);
          setNowPlaying({ docId, title: document.title, isPlaying: playing });
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnded}
      />

      {/* Chapter progress mini-map */}
      {document.chapters.length > 1 && (
        <div className="bg-surface border border-hairline rounded-sm p-4">
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
                  <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isComplete ? "bg-gold/50" : isCurrent ? "bg-gold" : ""
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-surface-hover border border-hairline-strong rounded-sm text-[10px] text-paper/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {ch.title}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="label-mono text-paper/40">Ch. 1</span>
            <span className="label-mono text-gold">
              Chapter {currentChapterIndex + 1} of {document.chapters.length}
            </span>
            <span className="label-mono text-paper/40">Ch. {document.chapters.length}</span>
          </div>
        </div>
      )}

      {activeTab === "reader" && (
        <motion.div
          key="reader"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/40 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-sm bg-surface border border-hairline text-paper font-serif placeholder-paper/40 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
            />
          </div>
          <ReaderView
            chapters={document.chapters}
            currentChapterIndex={currentChapterIndex}
            onChapterSelect={handleChapterSelect}
            onPlayFromText={handlePlayFromText}
            onHighlight={(chapterIndex, text) => {
              addHighlightForDoc(docId, text, chapterIndex);
              showToast("Highlight saved");
            }}
            isPlaying={isPlaying}
            chapterProgress={(() => {
              if (!document.audio_duration) return 0;
              const ch = document.chapters;
              const chStart = ch[currentChapterIndex]?.start_time ?? 0;
              const chEnd = ch[currentChapterIndex + 1]?.start_time ?? document.audio_duration;
              const chDuration = chEnd - chStart;
              return chDuration > 0 ? (currentTime - chStart) / chDuration : 0;
            })()}
            searchQuery={searchQuery}
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

      {activeTab === "flashcards" && (
        <motion.div
          key="flashcards"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <FlashcardsView docId={docId} />
        </motion.div>
      )}

      {autoplayNext && (() => {
        const nextDoc = getNextCompletedDoc();
        if (!nextDoc) return null;
        return (
          <div className="bg-surface border border-hairline rounded-sm px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-paper/60">
              <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              <span className="label-mono text-paper/40">Up next:</span>
              <Link
                href={`/player/${nextDoc.id}`}
                className="text-gold hover:text-gold-soft font-medium transition-colors"
              >
                {nextDoc.title} &rarr;
              </Link>
            </div>
          </div>
        );
      })()}
    </motion.div>
  );
}

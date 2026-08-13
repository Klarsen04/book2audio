"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { fireConfetti } from "./Confetti";

interface Props {
  jobId: string;
  title: string;
  chapters: { title: string; word_count: number }[];
  wordCount: number;
  onConversionComplete: () => void;
  onBack: () => void;
}

interface Voice {
  id: string;
  gender: string;
  engine: string;
}

// Approximate fraction of the text kept by each summary level.
// Kept in sync with backend/app/summarizer.py.
const SUMMARY_RATIOS: Record<string, number> = {
  full: 1,
  long_summary: 0.35,
  short_summary: 0.12,
};

export default function ConversionPanel({
  jobId,
  title,
  chapters,
  wordCount,
  onConversionComplete,
  onBack,
}: Props) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("default_voice") || "Joanna";
    }
    return "Joanna";
  });
  const [audioType, setAudioType] = useState("full");
  const [introSummary, setIntroSummary] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [freeingSpace, setFreeingSpace] = useState(false);
  const [splitInfo, setSplitInfo] = useState<{ totalParts: number } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const convertStartRef = useRef<number | null>(null);

  useEffect(() => {
    api.get("/api/voices").then((res) => {
      setVoices(res.data.voices);
    });
  }, []);

  useEffect(() => {
    if (!isConverting) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/status/${jobId}`);
        setProgress(res.data.progress);
        setCurrentChapter(res.data.current_chapter);

        if (res.data.status === "completed") {
          clearInterval(interval);
          setIsConverting(false);
          fireConfetti();
          onConversionComplete();
        } else if (res.data.status === "error") {
          clearInterval(interval);
          setIsConverting(false);
          setError(res.data.error || "Conversion failed");
        }
      } catch {
        clearInterval(interval);
        setIsConverting(false);
        setError("Lost connection to server");
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isConverting, jobId, onConversionComplete]);

  const handleConvert = async () => {
    setIsConverting(true);
    setError(null);
    setErrorCode(null);
    setProgress(0);
    convertStartRef.current = Date.now();

    try {
      const res = await api.post(
        `/api/convert/${jobId}?voice=${selectedVoice}&audio_type=${audioType}&intro=${introSummary}`
      );
      if (res.data?.split && res.data?.total_parts > 1) {
        setSplitInfo({ totalParts: res.data.total_parts });
      }
    } catch (err: any) {
      setIsConverting(false);
      // `detail` may be a plain string or a structured object ({code, message}).
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === "object") {
        setError(detail.message || "Failed to start conversion");
        setErrorCode(detail.code || null);
      } else {
        setError(detail || "Failed to start conversion");
        setErrorCode(null);
      }
    }
  };

  // Download the whole library as one .zip so the user keeps their audiobooks.
  const handleExportLibrary = async () => {
    try {
      const res = await api.get("/api/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "book2audio-library.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // best-effort
    }
  };

  // Clear the library to free the storage quota, then return to a fresh start.
  const handleClearAndRestart = async () => {
    setFreeingSpace(true);
    try {
      await api.delete("/api/library");
      onBack();
    } catch {
      setError("Couldn't clear your library. Please try again.");
    } finally {
      setFreeingSpace(false);
    }
  };

  const playPreview = (voiceId: string) => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (previewPlaying === voiceId) {
      audio.pause();
      setPreviewPlaying(null);
      return;
    }

    audio.src = `/api/voices/preview/${voiceId}`;
    audio.play().catch(() => {});
    setPreviewPlaying(voiceId);
  };

  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    const onEnd = () => setPreviewPlaying(null);
    const onPause = () => setPreviewPlaying(null);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const estimatedMinutes = Math.ceil(wordCount / 150);

  const summaryRatio = SUMMARY_RATIOS[audioType] ?? 1;
  const estimatedSummaryWords = Math.round(wordCount * summaryRatio);
  const estimatedSummaryMinutes = Math.max(1, Math.ceil(estimatedSummaryWords / 150));

  return (
    <div className="space-y-6">
      <audio ref={previewAudioRef} preload="none" />

      <button
        onClick={onBack}
        className="text-sm text-paper/60 hover:text-paper transition-colors flex items-center gap-1.5 group font-serif"
      >
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
        Upload a different file
      </button>

      {/* Book info */}
      <div className="bg-surface-hover border border-hairline-strong rounded-sm p-6">
        <h2 className="text-xl font-display text-paper mb-2">{title}</h2>
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            `${chapters.length} chapter${chapters.length !== 1 ? "s" : ""}`,
            `${wordCount.toLocaleString()} words`,
            `~${estimatedMinutes} min audio`,
          ].map((stat) => (
            <span
              key={stat}
              className="px-3 py-1 rounded-full bg-surface border border-hairline label-mono text-paper/60"
            >
              {stat}
            </span>
          ))}
        </div>

        <div className="rounded-sm border border-hairline max-h-48 overflow-y-auto">
          {chapters.map((ch, i) => (
            <div
              key={i}
              className="flex justify-between items-center px-4 py-2.5 border-b border-hairline last:border-0 hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="label-mono text-paper/40 w-5">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-paper/60 text-sm font-serif">{ch.title}</span>
              </div>
              <span className="label-mono text-paper/40">{ch.word_count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Audio type selection */}
      <div className="bg-surface-hover border border-hairline-strong rounded-sm p-6">
        <h3 className="label-mono text-paper/60 mb-4">Audio Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: "full",
              label: "Full Text",
              description: "Reads the entire document, start to finish.",
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              ),
            },
            {
              id: "long_summary",
              label: "Long Summary",
              description: "Keeps the key sentences of each chapter. Around a third of the length.",
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                </svg>
              ),
            },
            {
              id: "short_summary",
              label: "Short Summary",
              description: "A concise overview — only the highest-scoring sentences.",
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h8.25" />
                </svg>
              ),
            },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setAudioType(type.id)}
              disabled={isConverting}
              className={`flex flex-col items-start gap-2 p-4 rounded-sm text-left transition-all ${
                audioType === type.id
                  ? "bg-gold/10 border border-gold/30 text-paper"
                  : "bg-surface border border-hairline text-paper/60 hover:bg-surface-hover hover:border-hairline-strong"
              } disabled:opacity-50`}
            >
              <div className={`${audioType === type.id ? "text-gold" : "text-paper/40"}`}>
                {type.icon}
              </div>
              <span className="text-sm font-serif">{type.label}</span>
              <span className="text-xs text-paper/40 leading-relaxed font-serif">{type.description}</span>
            </button>
          ))}
        </div>

        {/* Reduction preview for summary modes */}
        {audioType !== "full" && (
          <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between text-xs">
            <span className="text-paper/40 font-serif">Estimated after summarizing</span>
            <span className="text-gold font-medium label-mono">
              ~{estimatedSummaryWords.toLocaleString()} words · ~{estimatedSummaryMinutes} min audio
              <span className="text-paper/40 font-normal">
                {" "}(down from {wordCount.toLocaleString()})
              </span>
            </span>
          </div>
        )}

        {/* Spoken-summary intro toggle — independent of the audio type above.
            Adds a ~1-min "Summary" chapter at the start; the main audio is
            unchanged. */}
        <label
          className={`mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-sm border p-4 transition-all ${
            introSummary
              ? "border-gold/30 bg-gold/10"
              : "border-hairline bg-surface hover:border-hairline-strong"
          } ${isConverting ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div>
            <span className="block text-sm font-serif text-paper">
              Start with a spoken summary
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-paper/40 font-serif">
              Adds a short overview of what the audio is about at the very
              beginning — like a preview — then plays your selection above in
              full. Shows as a &ldquo;Summary&rdquo; chapter you can skip.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={introSummary}
            onClick={() => setIntroSummary((v) => !v)}
            disabled={isConverting}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
              introSummary ? "bg-gold" : "bg-paper/15"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full transition-transform ${
                introSummary ? "left-6 bg-ink" : "left-1 bg-paper"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Voice selection with preview */}
      <div className="bg-surface-hover border border-hairline-strong rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="label-mono text-paper/60">Choose a voice</h3>
          <span className="text-xs text-paper/40 font-serif">Click speaker icon to preview</span>
        </div>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } }
          }}
        >
          {voices.map((voice) => (
            <motion.div
              key={voice.id}
              className="relative"
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <button
                onClick={() => setSelectedVoice(voice.id)}
                disabled={isConverting}
                className={`w-full px-4 py-3 rounded-sm text-sm font-serif transition-all text-left ${
                  selectedVoice === voice.id
                    ? "bg-gold/10 border border-gold/30 text-paper"
                    : "bg-surface border border-hairline text-paper/60 hover:bg-surface-hover hover:border-hairline-strong"
                } disabled:opacity-50`}
              >
                <span className="block">{voice.id}</span>
                <span className="block label-mono opacity-50 mt-0.5">{voice.gender}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playPreview(voice.id);
                }}
                className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  previewPlaying === voice.id
                    ? "bg-gold text-ink scale-110"
                    : "bg-surface-active text-paper/60 hover:bg-surface-hover hover:text-paper"
                }`}
                title={`Preview ${voice.id}`}
              >
                {previewPlaying === voice.id ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                )}
              </button>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Progress / Convert button */}
      {isConverting ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-hover border border-hairline-strong rounded-sm p-6"
        >
          {splitInfo && (
            <div className="mb-4 rounded-sm border border-gold/30 bg-gold/[0.06] px-4 py-3 text-sm font-serif text-paper/80">
              Large book — splitting into <span className="text-gold">{splitInfo.totalParts} parts</span> so each converts reliably. You can start listening to Part 1 while the rest finishes in the background.
            </div>
          )}
          <div className="flex justify-between text-sm mb-3">
            <span className="text-paper/60 font-serif">
              {splitInfo
                ? `Converting Part 1 — chapter ${currentChapter} of ${chapters.length}...`
                : `Converting chapter ${currentChapter} of ${chapters.length}...`}
            </span>
            <span className="text-gold font-semibold label-mono">{progress}%</span>
          </div>
          <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gold"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-paper/40 mt-3 font-serif">
            {(() => {
              const start = convertStartRef.current;
              if (progress > 2 && progress < 100 && start) {
                // Extrapolate from real elapsed time — accurate once underway.
                const elapsedMin = (Date.now() - start) / 60000;
                const remaining = Math.max(1, Math.ceil((elapsedMin / progress) * (100 - progress)));
                return `About ${remaining} min remaining · large books take a while on the free tier`;
              }
              return progress >= 100
                ? "Finishing up…"
                : "Estimating… large books can take several minutes.";
            })()}
          </p>
        </motion.div>
      ) : (
        <motion.button
          onClick={handleConvert}
          disabled={!!error}
          className="w-full py-4 rounded-sm bg-gold text-ink font-semibold text-lg hover:bg-gold-soft transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
        >
          Convert to Audiobook
        </motion.button>
      )}

      {error && errorCode === "quota_exceeded" ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-hover border border-gold/30 rounded-sm p-6 space-y-4"
        >
          <div>
            <h3 className="text-paper font-display text-lg mb-1">Your library is full</h3>
            <p className="text-paper/60 text-sm font-serif leading-relaxed">{error}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportLibrary}
              className="flex-1 py-3 rounded-sm bg-gold text-ink font-semibold hover:bg-gold-soft transition-all"
            >
              ⬇ Download my audiobooks (.zip)
            </button>
            <button
              onClick={handleClearAndRestart}
              disabled={freeingSpace}
              className="flex-1 py-3 rounded-sm bg-surface border border-hairline-strong text-paper/80 font-serif hover:bg-surface-active transition-all disabled:opacity-50"
            >
              {freeingSpace ? "Clearing…" : "Clear library & start fresh"}
            </button>
          </div>
          <p className="text-paper/40 text-xs font-serif">
            Download first — clearing permanently deletes your audiobooks from the server to free up space.
          </p>
        </motion.div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-burgundy/10 border border-burgundy/30 rounded-sm p-4 text-burgundy-soft text-sm font-serif"
        >
          {error}
        </motion.div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { motion } from "framer-motion";

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

const PREVIEW_AVAILABLE = ["matthew", "joanna", "amy", "brian", "ruth"];

export default function ConversionPanel({
  jobId,
  title,
  chapters,
  wordCount,
  onConversionComplete,
  onBack,
}: Props) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("Joanna");
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

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
    setProgress(0);

    try {
      await api.post(`/api/convert/${jobId}?voice=${selectedVoice}`);
    } catch (err: any) {
      setIsConverting(false);
      setError(err.response?.data?.detail || "Failed to start conversion");
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

    const name = voiceId.toLowerCase();
    if (!PREVIEW_AVAILABLE.includes(name)) return;

    audio.src = `/samples/preview-${name}.mp3`;
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

  return (
    <div className="space-y-6">
      <audio ref={previewAudioRef} preload="none" />

      <button
        onClick={onBack}
        className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 group"
      >
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
        Upload a different file
      </button>

      {/* Book info */}
      <div className="glass-strong rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
        <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-5">
          {[
            `${chapters.length} chapter${chapters.length !== 1 ? "s" : ""}`,
            `${wordCount.toLocaleString()} words`,
            `~${estimatedMinutes} min audio`,
          ].map((stat) => (
            <span
              key={stat}
              className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs"
            >
              {stat}
            </span>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] max-h-48 overflow-y-auto">
          {chapters.map((ch, i) => (
            <div
              key={i}
              className="flex justify-between items-center px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-600 w-5">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-gray-300 text-sm">{ch.title}</span>
              </div>
              <span className="text-gray-600 text-xs">{ch.word_count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Voice selection with preview */}
      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Choose a voice</h3>
          <span className="text-xs text-gray-500">Click speaker icon to preview</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {voices.map((voice) => {
            const hasPreview = PREVIEW_AVAILABLE.includes(voice.id.toLowerCase());
            return (
              <div key={voice.id} className="relative">
                <button
                  onClick={() => setSelectedVoice(voice.id)}
                  disabled={isConverting}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                    selectedVoice === voice.id
                      ? "bg-purple-600/20 border border-purple-500/40 text-white"
                      : "bg-white/[0.03] border border-white/[0.06] text-gray-300 hover:bg-white/[0.06] hover:border-white/[0.1]"
                  } disabled:opacity-50`}
                >
                  <span className="block">{voice.id}</span>
                  <span className="block text-xs opacity-50 mt-0.5">{voice.gender}</span>
                </button>
                {hasPreview && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(voice.id);
                    }}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      previewPlaying === voice.id
                        ? "bg-purple-500 text-white scale-110"
                        : "bg-white/[0.08] text-gray-400 hover:bg-white/[0.15] hover:text-white"
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress / Convert button */}
      {isConverting ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-6"
        >
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-300">
              Converting chapter {currentChapter} of {chapters.length}...
            </span>
            <span className="text-purple-300 font-semibold">{progress}%</span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {progress > 0 && progress < 100
              ? `Estimated ${Math.ceil(((100 - progress) / Math.max(progress, 1)) * (chapters.length * 0.5))} min remaining`
              : "This may take a few minutes depending on book length."}
          </p>
        </motion.div>
      ) : (
        <button
          onClick={handleConvert}
          disabled={!!error}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 font-semibold text-lg hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] active:scale-[0.99]"
        >
          Convert to Audiobook
        </button>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}

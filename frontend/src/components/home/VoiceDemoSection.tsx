"use client";

import { useState, useEffect, useRef } from "react";
import SectionShell from "./SectionShell";

const voiceDemoTabs = [
  { id: "research", label: "Research paper" },
  { id: "book", label: "Book" },
  { id: "article", label: "Article" },
  { id: "legal", label: "Legal" },
] as const;

const voiceDemoTexts: Record<string, string> = {
  research:
    "The experiment showed a 27% reduction in failures versus the baseline, with p < 0.001 using a t-test.",
  book:
    "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.",
  article:
    "Scientists have discovered a new species of deep-sea fish that produces its own light using a previously unknown chemical process.",
  legal:
    "Pursuant to Section 4.2 of the Agreement, the parties hereby acknowledge and agree that all intellectual property rights shall remain vested.",
};

const voiceOptions = [
  { id: "Joanna", label: "Joanna — female, clear" },
  { id: "Matthew", label: "Matthew — male, warm" },
  { id: "Ruth", label: "Ruth — female, expressive" },
  { id: "Stephen", label: "Stephen — male, deep" },
];

const speedOptions = ["0.75x", "1x", "1.25x", "1.5x", "2x"];

export default function VoiceDemoSection() {
  const [activeTab, setActiveTab] = useState<string>("research");
  const [selectedVoice, setSelectedVoice] = useState(voiceOptions[0].id);
  const [speed, setSpeed] = useState("1x");
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrl = useRef<string | null>(null);

  // Wire up real playback state from the audio element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onDone = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onDone);
    audio.addEventListener("ended", onDone);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onDone);
      audio.removeEventListener("ended", onDone);
    };
  }, []);

  // Reflect the speed dropdown onto the audio element live.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = parseFloat(speed) || 1;
    }
  }, [speed, isPlaying]);

  useEffect(() => {
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Toggle off if already playing.
    if (isPlaying) {
      audio.pause();
      return;
    }

    setError(false);
    setIsLoading(true);
    try {
      // Stop any other audio on the page.
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== audio) a.pause();
      });

      const text = voiceDemoTexts[activeTab];
      const res = await fetch(
        `/api/voices/preview/${selectedVoice}?text=${encodeURIComponent(text)}`
      );
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);

      const blob = await res.blob();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      audio.src = objectUrl.current;
      audio.playbackRate = parseFloat(speed) || 1;
      await audio.play();
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SectionShell kicker="Try a voice" title="Hear how your document will read">
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {voiceDemoTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`label-mono rounded-full border px-4 py-2 transition-colors ${
              activeTab === tab.id
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-hairline text-paper/50 hover:text-paper"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div >

      <div className="mx-auto max-w-2xl rounded-sm border border-hairline bg-surface p-8">
        <p
          key={activeTab}
          className="animate-ink-in mb-6 min-h-[80px] font-serif text-xl italic leading-relaxed text-paper/85"
        >
          &ldquo;{voiceDemoTexts[activeTab]}&rdquo;
        </p>

        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label-mono mb-1 block text-paper/40">Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-sm border border-hairline bg-ink px-3 py-2.5 font-serif text-paper focus:border-gold/50 focus:outline-none"
            >
              {voiceOptions.map((v) => (
                <option key={v.id} value={v.id} className="bg-ink">
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-28">
            <label className="label-mono mb-1 block text-paper/40">Speed</label>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-sm border border-hairline bg-ink px-3 py-2.5 font-serif text-paper focus:border-gold/50 focus:outline-none"
            >
              {speedOptions.map((s) => (
                <option key={s} value={s} className="bg-ink">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePlay}
            disabled={isLoading}
            aria-label={isPlaying ? "Stop preview" : "Play preview"}
            className="flex items-center justify-center gap-2 rounded-sm bg-gold px-6 py-2.5 font-display text-lg text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                Loading…
              </>
            ) : isPlaying ? (
              <>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                Stop
              </>
            ) : (
              <>
                <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-4 font-serif text-sm text-burgundy-soft">
            Couldn&rsquo;t generate that preview just now. Please try again.
          </p>
        )}
        <audio ref={audioRef} preload="none" />
      </div>
    </SectionShell>
  );
}

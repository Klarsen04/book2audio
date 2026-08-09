"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SmoothScroll from "@/components/motion/SmoothScroll";
import TransformStage from "@/components/home/TransformStage";
import ArtifactScene from "@/components/home/ArtifactScene";
import WaveCanvas from "@/components/motion/WaveCanvas";
import RestoreDialog from "@/components/RestoreDialog";

/* ------------------------------------------------------------------ */
/* Editorial masthead — gains a backdrop once past the hero           */
/* ------------------------------------------------------------------ */
function Masthead({ onRestore }: { onRestore: () => void }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? "border-b border-hairline bg-[#16130f]/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="font-display text-xl font-bold text-paper">
          Book<span className="text-gold">2</span>Audio
        </span>
        <div className="flex items-center gap-6">
          <button
            onClick={onRestore}
            className="font-serif text-sm text-paper/60 transition-colors hover:text-paper"
          >
            Restore session
          </button>
          <Link
            href="/convert"
            className="label-mono rounded-full border border-gold/40 px-5 py-2 text-gold transition-colors hover:bg-gold/10"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable audio sample player (real /public/samples/*.mp3)          */
/* ------------------------------------------------------------------ */
function AudioSample({ src, label, sublabel }: { src: string; label: string; sublabel: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== audio) a.pause();
      });
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () =>
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    const onEnd = () => setProgress(0);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("timeupdate", onTime);
    };
  }, []);

  return (
    <div
      className={`group flex items-center gap-4 rounded-sm border border-hairline bg-surface px-4 py-4 transition-colors hover:border-gold/30 ${
        playing ? "border-gold/40" : ""
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition-transform hover:scale-110 active:scale-95"
      >
        {playing ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base text-paper">{label}</p>
        <p className="label-mono text-paper/40">{sublabel}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper/10">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive voice demo (real /api/voices/preview)                  */
/* ------------------------------------------------------------------ */
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

function VoiceDemoSection() {
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
      </div>

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

/* ------------------------------------------------------------------ */
/* Small shared editorial section header                              */
/* ------------------------------------------------------------------ */
function SectionShell({
  kicker,
  title,
  lede,
  children,
  id,
}: {
  kicker: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-t border-hairline py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 max-w-2xl">
          <p className="label-mono text-gold">{kicker}</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-paper sm:text-5xl">
            {title}
          </h2>
          {lede && <p className="mt-4 font-serif text-lg text-paper/60">{lede}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */
export default function Home() {
  const [restoreOpen, setRestoreOpen] = useState(false);

  return (
    <SmoothScroll>
      <div className="relative min-h-screen overflow-x-hidden bg-[#16130f]">
        <Masthead onRestore={() => setRestoreOpen(true)} />
        <RestoreDialog open={restoreOpen} onClose={() => setRestoreOpen(false)} />

        {/* SCENES 1–5: the cinematic transformation (pinned, scrubbed) */}
        <TransformStage />

        {/* SCENE 6: the finished artifact + reversibility */}
        <ArtifactScene />

        {/* ---- Product sections (restyled, real content preserved) ---- */}

        {/* Supported formats */}
        <SectionShell
          kicker="What you can bring"
          title="Any document, turned into a voice"
          lede="Drop in whatever you're reading. Chapters, structure and clean text are handled for you."
        >
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Research papers", "Academic PDFs"],
              ["PDF books", "Any PDF file"],
              ["EPUB books", "E-book format"],
              ["Web articles", "Any URL"],
              ["Legal docs", "Contracts & briefs"],
              ["Plain text", "TXT & markdown"],
              ["Slides", "Presentations"],
              ["Word docs", "DOCX files"],
              ["Scanned forms", "OCR handled"],
              ["Textbooks", "With equations"],
            ].map(([label, desc]) => (
              <div key={label} className="bg-[#16130f] px-5 py-6 transition-colors hover:bg-surface">
                <p className="font-display text-base text-paper">{label}</p>
                <p className="label-mono mt-1 text-paper/40">{desc}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* Interactive voice demo */}
        <VoiceDemoSection />

        {/* Voice samples (real audio) */}
        <SectionShell
          kicker="The voices"
          title="Natural narration, not robotic text-to-speech"
          lede="Press play to hear each voice read a real excerpt."
          id="demo"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AudioSample src="/samples/voice-jenny.mp3" label="Jenny" sublabel="Warm & expressive · Fiction" />
            <AudioSample src="/samples/voice-guy.mp3" label="Guy" sublabel="Deep & authoritative · Science" />
            <AudioSample src="/samples/voice-aria.mp3" label="Aria" sublabel="Clear & friendly · Narration" />
            <AudioSample src="/samples/voice-andrew.mp3" label="Andrew" sublabel="Calm & measured · Non-fiction" />
          </div>
        </SectionShell>

        {/* Sample conversions (real audio) */}
        <SectionShell
          kicker="Try it yourself"
          title="Real excerpts, converted with Book2Audio"
          lede="These were made by the same pipeline you'll use. Press play."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DemoCard src="/samples/demo-gatsby.mp3" title="The Great Gatsby" author="F. Scott Fitzgerald" category="Fiction" voice="Guy" />
            <DemoCard src="/samples/demo-science.mp3" title="The Structure of DNA" author="Science textbook" category="Non-fiction" voice="Jenny" />
            <DemoCard src="/samples/demo-philosophy.mp3" title="The Allegory of the Cave" author="Plato" category="Philosophy" voice="Aria" />
          </div>
        </SectionShell>

        {/* Features */}
        <SectionShell
          kicker="Built for readers"
          title="More than text-to-speech — a listening experience"
        >
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["High-accuracy audio", "Tables, figures and math are summarised, not garbled — complex documents parsed correctly."],
              ["Smart text removal", "Footnotes, citations, page headings and other junk stripped automatically for clean flow."],
              ["Playback speed", "Listen from 0.5× to 3×. Choose your pace for study sessions or commutes."],
              ["Chapter navigation", "Auto-detected table of contents. Jump between chapters and sections instantly."],
              ["Reader view", "Follow along with reformatted text while you listen. Tap any passage to play from there."],
              ["Your library", "Every conversion in one place — organise, search and sync across devices."],
            ].map(([title, desc]) => (
              <div key={title} className="bg-[#16130f] p-8 transition-colors hover:bg-surface">
                <h3 className="font-display text-xl text-paper">{title}</h3>
                <p className="mt-3 font-serif leading-relaxed text-paper/60">{desc}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* Comparison */}
        <SectionShell kicker="Why Book2Audio" title="How it compares">
          <div className="overflow-hidden rounded-sm border border-hairline">
            <table className="w-full font-serif text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface">
                  <th className="p-4 text-left font-normal text-paper/50">Feature</th>
                  <th className="label-mono p-4 text-center text-gold">Book2Audio</th>
                  <th className="p-4 text-center font-normal text-paper/40">Audible</th>
                  <th className="p-4 text-center font-normal text-paper/40">Speechify</th>
                  <th className="p-4 text-center font-normal text-paper/40">Generic TTS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Your own documents", true, false, true, true],
                  ["Natural AI voices", true, true, true, false],
                  ["Handles math & figures", true, false, false, false],
                  ["Strips footnotes / junk", true, false, false, false],
                  ["Chapter detection", true, true, false, false],
                  ["Free to use", true, false, false, true],
                  ["Resume playback", true, true, true, false],
                  ["Reader view", true, false, true, false],
                  ["No subscription", true, false, false, true],
                  ["Open source", true, false, false, false],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="p-4 text-paper/80">{row[0] as string}</td>
                    {(row.slice(1) as boolean[]).map((v, j) => (
                      <td key={j} className="p-4 text-center">
                        {v ? (
                          <span className={j === 0 ? "text-gold" : "text-paper/50"}>✓</span>
                        ) : (
                          <span className="text-paper/20">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionShell>

        {/* Testimonials */}
        <SectionShell kicker="Readers" title="What people say">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              ["This is honestly a life saver. I have ADHD and struggle reading off a page. It delivers a better product than competitors, converting only the relevant text.", "App Store reviewer", "Student"],
              ["A PhD workflow game changer. Excellent for research papers on my commute — figures show up clearly and the voices sound natural.", "iOS user", "PhD researcher"],
              ["I've tried every text-to-speech app and this is the best. Handles large EPUBs flawlessly and I can listen offline while hiking.", "Power user", "Avid reader"],
            ].map(([quote, author, role], i) => (
              <figure key={i} className="rounded-sm border border-hairline bg-surface p-7">
                <blockquote className="font-serif text-lg italic leading-relaxed text-paper/80">
                  &ldquo;{quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5">
                  <p className="font-display text-paper">{author}</p>
                  <p className="label-mono text-paper/40">{role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </SectionShell>

        {/* FAQ */}
        <SectionShell kicker="Questions" title="Frequently asked">
          <div className="mx-auto max-w-3xl space-y-px overflow-hidden rounded-sm border border-hairline bg-hairline">
            {[
              ["Is it really free?", "Yes. Book2Audio is open source and free to use. No ads, no subscription, no hidden limits."],
              ["What formats are supported?", "PDF, EPUB, DOCX, TXT, web articles, slides, legal documents, research papers and more. Chapters and structure are detected automatically."],
              ["How does it handle tables, figures and math?", "Unlike generic TTS tools, Book2Audio summarises visual elements like tables and figures, reads math naturally, and removes inline references and footnotes for clean audio."],
              ["How long does conversion take?", "Typically 1–3 minutes for a full book. A 200-page book usually takes about 2 minutes."],
              ["Are the voices realistic?", "We use state-of-the-art neural voice engines with natural intonation and rhythm. Multiple voices — press play above to hear."],
              ["Is my data private?", "Your books are stored securely and never shared with third parties. Delete your data anytime."],
            ].map(([q, a], i) => (
              <details key={i} className="group bg-[#16130f]">
                <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-display text-lg text-paper transition-colors hover:text-gold">
                  {q}
                  <span className="text-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-6 pb-6 font-serif leading-relaxed text-paper/60">{a}</p>
              </details>
            ))}
          </div>
        </SectionShell>

        {/* Final CTA */}
        <section className="border-t border-hairline py-28">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <ClosingWave />
            <h2 className="mt-8 font-display text-4xl font-bold text-paper sm:text-6xl">
              Give your library a voice.
            </h2>
            <p className="mx-auto mt-5 max-w-xl font-serif text-lg text-paper/60">
              Upload your first document and have an audiobook in minutes. No sign-up, no credit card, no catch.
            </p>
            <Link
              href="/convert"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 font-display text-xl text-ink transition-transform hover:scale-[1.02] active:scale-95"
            >
              Add your first book →
            </Link>
          </div>
        </section>

        <footer className="border-t border-hairline py-10 text-center">
          <p className="label-mono text-paper/30">
            Open source · Privacy-first · No data sold to third parties
          </p>
        </footer>
      </div>
    </SmoothScroll>
  );
}

/* Small closing waveform flourish (idle, decorative) */
function ClosingWave() {
  const wave = useRef<any>(null);
  useEffect(() => {
    wave.current?.setAmp(0.7);
    wave.current?.setLife(1);
  }, []);
  return (
    <div className="mx-auto h-16 w-full max-w-md">
      <WaveCanvas ref={wave} className="h-full w-full" color="#D08A3E" points={120} lineWidth={2} />
    </div>
  );
}

/* Sample conversion card (real audio) */
function DemoCard({
  src,
  title,
  author,
  category,
  voice,
}: {
  src: string;
  title: string;
  author: string;
  category: string;
  voice: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== audio) a.pause();
      });
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () =>
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    const onEnd = () => setProgress(0);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("timeupdate", onTime);
    };
  }, []);

  return (
    <div className="rounded-sm border border-hairline bg-surface p-6 transition-colors hover:border-gold/30">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="mb-4 flex items-start justify-between">
        <span className="label-mono text-gold/70">{category}</span>
        <span className="label-mono text-paper/40">Voice · {voice}</span>
      </div>
      <h3 className="font-display text-xl text-paper">{title}</h3>
      <p className="mb-5 font-serif italic text-paper/50">{author}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition-transform hover:scale-110 active:scale-95"
        >
          {playing ? (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper/10">
          <div className="h-full rounded-full bg-gold transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

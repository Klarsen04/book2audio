"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import WaveCanvas, { WaveHandle } from "@/components/motion/WaveCanvas";

/**
 * Scene 6 — THE ARTIFACT. The transformation resolves into the real product:
 * a finished audiobook that presents as a book cover fused with a waveform
 * scrubber. A PAGE ⇄ WAVEFORM control states the transformation is reversible
 * (read it or hear it), which is the actual product's dual reader/listener modes.
 */
export default function ArtifactScene() {
  const root = useRef<HTMLDivElement>(null);
  const wave = useRef<WaveHandle>(null);
  const [mode, setMode] = useState<"page" | "wave">("wave");

  useGSAP(
    () => {
      wave.current?.setAmp(mode === "wave" ? 1 : 0.15);
      wave.current?.setLife(mode === "wave" ? 1 : 0);

      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.from(q(".artifact-book"), {
        yPercent: 14,
        rotateY: 24,
        autoAlpha: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: root.current, start: "top 70%" },
      });
      gsap.from(q(".artifact-copy > *"), {
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: root.current, start: "top 60%" },
      });
    },
    { scope: root, dependencies: [mode] }
  );

  const toggle = (m: "page" | "wave") => {
    setMode(m);
    wave.current?.setAmp(m === "wave" ? 1 : 0.15);
    wave.current?.setLife(m === "wave" ? 1 : 0);
  };

  return (
    <section
      ref={root}
      className="relative border-t border-hairline bg-[#16130f] px-6 py-28"
      style={{ perspective: "1400px" }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        {/* The finished artifact: cover + waveform, tangible */}
        <div className="artifact-book relative mx-auto w-full max-w-sm [transform-style:preserve-3d]">
          <div className="relative overflow-hidden rounded-r-md rounded-l-sm border border-hairline-strong bg-gradient-to-br from-burgundy-deep via-ink-soft to-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
            {/* spine highlight */}
            <span className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/50 to-transparent" aria-hidden />
            <div className="px-8 pt-10 pb-6">
              <p className="label-mono text-gold/70">Audiobook · 04 chapters · 31 min</p>
              <h3 className="mt-4 font-display text-3xl font-bold leading-tight text-paper">
                The First Recording
              </h3>
              <p className="mt-2 font-serif italic text-paper/55">read aloud, chapter by chapter</p>
            </div>
            {/* waveform scrubber */}
            <div className="h-24 w-full px-6">
              <WaveCanvas ref={wave} className="h-full w-full" color="#D08A3E" points={140} lineWidth={2} />
            </div>
            <div className="flex items-center gap-4 px-8 pb-8 pt-2">
              <button
                aria-label="Play preview"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-ink transition-transform hover:scale-105 active:scale-95"
              >
                <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="flex-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-paper/12">
                  <div className="h-full w-1/3 rounded-full bg-gold" />
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="label-mono text-paper/40">10:24</span>
                  <span className="label-mono text-paper/40">31:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copy + reversibility control */}
        <div className="artifact-copy">
          <p className="label-mono text-gold">The finished book</p>
          <h2 className="mt-4 max-w-md font-display text-4xl font-bold leading-tight text-paper sm:text-5xl">
            Read it or hear it. The transformation runs both ways.
          </h2>
          <p className="mt-5 max-w-md font-serif text-lg text-paper/60">
            Every conversion keeps the text and the audio side by side — follow
            along in the reader, or close your eyes and listen. Chapters, speed,
            bookmarks and sleep timer included.
          </p>

          {/* PAGE ⇄ WAVEFORM toggle */}
          <div
            className="mt-8 inline-flex items-center rounded-full border border-hairline p-1"
            role="group"
            aria-label="Toggle between page and waveform"
          >
            <button
              onClick={() => toggle("page")}
              className={`label-mono rounded-full px-5 py-2 transition-colors ${
                mode === "page" ? "bg-paper text-ink" : "text-paper/50 hover:text-paper"
              }`}
            >
              Page
            </button>
            <span className="px-2 text-gold" aria-hidden>
              ⇄
            </span>
            <button
              onClick={() => toggle("wave")}
              className={`label-mono rounded-full px-5 py-2 transition-colors ${
                mode === "wave" ? "bg-gold text-ink" : "text-paper/50 hover:text-paper"
              }`}
            >
              Waveform
            </button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 font-display text-lg text-ink transition-transform hover:scale-[1.02] active:scale-95"
            >
              Turn your first page
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/login" className="font-serif text-paper/60 underline-offset-4 hover:text-paper hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

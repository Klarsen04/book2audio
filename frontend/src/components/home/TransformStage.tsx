"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import WaveCanvas, { WaveHandle } from "@/components/motion/WaveCanvas";

const LIFT_LINE = "Every page becomes a voice you can hear".split(" ");
const VOICES = ["Joanna", "Matthew", "Ruth", "Stephen"];
const CHAPTERS = [
  { n: "01", t: "The First Recording", time: "00:00" },
  { n: "02", t: "Margins & Structure", time: "08:24" },
  { n: "03", t: "A Voice Emerges", time: "17:10" },
  { n: "04", t: "The Finished Book", time: "26:47" },
];

/**
 * The cinematic centerpiece. A pinned, scroll-scrubbed master timeline that runs:
 *   spine → page → junk-strip → words lift → voice/waveform → chapters.
 * Each act cross-dissolves; the WaveCanvas amplitude is scrubbed so a line of text
 * and a line of sound are literally the same stroke. Degrades to a static hero
 * when the user prefers reduced motion.
 */
export default function TransformStage() {
  const root = useRef<HTMLDivElement>(null);
  const wave = useRef<WaveHandle>(null);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();
      const q = gsap.utils.selector(root);

      // Static, readable state for reduced motion (no pin, no scrub).
      if (reduced) {
        gsap.set(q(".act"), { autoAlpha: 0 });
        gsap.set(q(".act-hero"), { autoAlpha: 1 });
        wave.current?.setAmp(0.55);
        wave.current?.setLife(0);
        return;
      }

      const acts = {
        hero: q(".act-hero"),
        page: q(".act-page"),
        lift: q(".act-lift"),
        voice: q(".act-voice"),
        chapters: q(".act-chapters"),
      };

      // start states
      gsap.set([acts.page, acts.lift, acts.voice, acts.chapters], {
        autoAlpha: 0,
      });
      gsap.set(acts.hero, { autoAlpha: 1 });
      gsap.set(q(".lift-word"), { yPercent: 40, autoAlpha: 0 });
      gsap.set(q(".voice-chip"), { y: 16, autoAlpha: 0 });
      gsap.set(q(".chapter-row"), { x: -24, autoAlpha: 0 });
      gsap.set(q(".ms-page"), { yPercent: 12, scale: 0.96, autoAlpha: 0 });

      const amp = { v: 0, life: 1 };
      const applyWave = () => {
        wave.current?.setAmp(amp.v);
        wave.current?.setLife(amp.life);
      };
      applyWave();

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=520%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      // ── ACT 1 → 2: the baseline of the headline wakes up and becomes a wave
      tl.addLabel("hero")
        .to(amp, { v: 0.32, duration: 1, onUpdate: applyWave }, 0)
        .to(q(".hero-head"), { yPercent: -60, scale: 0.62, autoAlpha: 0.0, ease: "power2.in" }, 0.4)
        .to(q(".hero-sub"), { autoAlpha: 0, y: -20 }, 0.4)
        .to(acts.hero, { autoAlpha: 0, duration: 0.4 }, 0.7)

        // ── ACT 2: the page arrives (UPLOAD)
        .to(acts.page, { autoAlpha: 1, duration: 0.5 }, 0.7)
        .to(q(".ms-page"), { yPercent: 0, scale: 1, autoAlpha: 1, duration: 1, ease: "power3.out" }, 0.8)
        .fromTo(q(".step-01"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 1.0)

        // ── ACT 2b: strip the junk (footnote / header / page no.)
        .to(q(".junk"), { color: "#7C2D3A", duration: 0.3 }, 1.9)
        .to(q(".junk"), { autoAlpha: 0, height: 0, margin: 0, duration: 0.6, stagger: 0.08, ease: "power2.in" }, 2.15)

        // ── ACT 3: words lift off the page (PARSE)
        .to(q(".ms-page"), { yPercent: -8, scale: 0.9, autoAlpha: 0, filter: "blur(3px)", duration: 1 }, 2.9)
        .to(acts.page, { autoAlpha: 0, duration: 0.5 }, 3.4)
        .to(acts.lift, { autoAlpha: 1, duration: 0.4 }, 3.0)
        .to(
          q(".lift-word"),
          { yPercent: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" },
          3.1
        )
        .fromTo(q(".step-02"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 3.2)

        // words drift up and dissolve toward the wave
        .to(amp, { v: 0.6, duration: 1, onUpdate: applyWave }, 3.9)
        .to(
          q(".lift-word"),
          { yPercent: -140, autoAlpha: 0, filter: "blur(4px)", duration: 1, stagger: 0.05, ease: "power2.in" },
          3.9
        )
        .to([acts.lift, q(".step-02")], { autoAlpha: 0, duration: 0.4 }, 4.5)

        // ── ACT 4: the voice / full waveform (TTS)
        .to(acts.voice, { autoAlpha: 1, duration: 0.5 }, 4.4)
        .to(amp, { v: 1, duration: 1, onUpdate: applyWave }, 4.5)
        .fromTo(q(".step-03"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 4.6)
        .to(q(".voice-chip"), { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1, ease: "back.out(1.6)" }, 4.7)

        // ── ACT 5: the waveform segments into chapters (STRUCTURE)
        // The master wave recedes almost entirely — the chapter act carries its
        // own tick-waveform, so keeping the big one would collide with the list.
        .to(q(".voice-chip"), { autoAlpha: 0, y: -12, duration: 0.4 }, 5.4)
        .to(q(".wave-shell"), { autoAlpha: 0.12, scale: 0.88, duration: 0.8 }, 5.4)
        .to(amp, { v: 0.5, life: 0.3, duration: 0.8, onUpdate: applyWave }, 5.4)
        .to(q(".chapter-tick"), { scaleY: 1, autoAlpha: 1, duration: 0.5, stagger: 0.06 }, 5.6)
        .to(acts.chapters, { autoAlpha: 1, duration: 0.5 }, 5.5)
        .fromTo(q(".step-04"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 5.6)
        .to(q(".chapter-row"), { x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.12, ease: "power3.out" }, 5.7);
    },
    { scope: root }
  );

  return (
    <section
      ref={root}
      aria-label="How a page becomes a voice"
      className="relative h-screen w-full overflow-hidden bg-[#16130f]"
    >
      {/* Progress rail (mono, editorial) */}
      <div className="pointer-events-none absolute left-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        {["SPINE", "PAGE", "WORDS", "VOICE", "CHAPTERS"].map((s) => (
          <span key={s} className="label-mono text-[9px] text-paper/25">
            {s}
          </span>
        ))}
      </div>

      {/* The wave lives across the whole stage; amplitude is scrubbed by the timeline. */}
      <div className="wave-shell absolute inset-x-0 top-1/2 z-10 h-[42vh] -translate-y-1/2 will-change-transform">
        <WaveCanvas ref={wave} className="h-full w-full" color="#D08A3E" bars points={200} />
      </div>

      {/* ACT: HERO SPINE */}
      <div className="act act-hero absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
        <p className="hero-sub label-mono mb-6 text-gold/80">
          Audio ⇄ Page · a reversible transformation
        </p>
        <h1 className="hero-head max-w-4xl font-display text-5xl font-black leading-[1.02] tracking-tight text-paper sm:text-7xl lg:text-8xl">
          Every page
          <br />
          has a <span className="italic text-gold">voice</span>.
        </h1>
        <p className="hero-sub mt-8 max-w-xl font-serif text-lg text-paper/60">
          Scroll to watch a document become an audiobook — words strip down, lift
          off the page, and turn into sound.
        </p>
      </div>

      {/* ACT: PAGE */}
      <div className="act act-page absolute inset-0 z-20 flex items-center justify-center px-6">
        <div className="ms-page w-full max-w-md will-change-transform">
          <ManuscriptPageWithJunk />
        </div>
        <StepBadge className="step-01" step="01" label="Upload" note="PDF · EPUB · DOCX · TXT — chapters detected automatically" />
      </div>

      {/* ACT: WORDS LIFT */}
      <div className="act act-lift absolute inset-0 z-20 flex items-center justify-center px-6">
        <p className="flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center font-display text-3xl font-semibold text-paper sm:text-5xl">
          {LIFT_LINE.map((w, i) => (
            <span key={i} className="lift-word inline-block will-change-transform">
              {w}
            </span>
          ))}
        </p>
        <StepBadge className="step-02" step="02" label="Parse" note="clean text extracted from the page" />
      </div>

      {/* ACT: VOICE */}
      <div className="act act-voice absolute inset-0 z-20 flex flex-col items-center justify-center px-6">
        <div className="mb-[36vh] flex flex-wrap items-center justify-center gap-2">
          {VOICES.map((v) => (
            <span
              key={v}
              className="voice-chip label-mono rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[11px] tracking-widest text-gold"
            >
              {v}
            </span>
          ))}
        </div>
        <StepBadge className="step-03" step="03" label="Voice" note="natural neural narration, chosen by you" />
      </div>

      {/* ACT: CHAPTERS */}
      <div className="act act-chapters absolute inset-0 z-20 flex items-center justify-center px-6">
        <div className="w-full max-w-2xl">
          {/* chapter ticks sit over the waveform */}
          <div className="mb-8 flex h-16 items-end justify-between gap-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="chapter-tick w-full origin-bottom bg-gold/50"
                style={{ height: `${20 + ((i * 37) % 60)}%`, transform: "scaleY(0)" }}
              />
            ))}
          </div>
          <ul className="divide-y divide-hairline">
            {CHAPTERS.map((c) => (
              <li key={c.n} className="chapter-row flex items-baseline justify-between py-3">
                <span className="label-mono text-gold/70">CH. {c.n}</span>
                <span className="flex-1 px-4 font-display text-lg text-paper sm:text-xl">{c.t}</span>
                <span className="label-mono text-paper/40">{c.time}</span>
              </li>
            ))}
          </ul>
          <StepBadge className="step-04 !static mt-6" step="04" label="Structure" note="jump between chapters while you listen" inline />
        </div>
      </div>
    </section>
  );
}

/** Manuscript variant whose junk elements (footnote, header, page no.) are tagged for stripping. */
function ManuscriptPageWithJunk() {
  return (
    <article className="paper-panel paper-grain relative flex flex-col rounded-[3px] px-8 py-9 sm:px-11 sm:py-12">
      <span className="pointer-events-none absolute inset-y-6 left-[13%] w-px bg-burgundy/25" aria-hidden />
      <p className="junk label-mono mb-3 text-ink/35">Running header · The First Recording</p>
      <p className="label-mono text-burgundy/80">Chapter One</p>
      <h3 className="mt-2 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
        The First Recording
      </h3>
      <div className="mt-5 space-y-3 text-[13.5px] leading-relaxed text-ink/85 font-serif [text-align:justify] [hyphens:auto]">
        <p>
          The recording began before dawn, a single voice against the hum of the
          room.<sup className="junk text-burgundy">12</sup> Every sentence carried
          the weight of the thing it described.
        </p>
        <p>
          What arrives as sound leaves as structure — the words find their margins,
          the paragraphs settle into columns, and the chapters announce themselves.
        </p>
        <p className="junk text-ink/40 !text-[11px]">
          12. See the appendix for a full account of the morning&rsquo;s session and
          related citations, ibid., pp. 204–211.
        </p>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="h-px w-10 bg-ink/20" aria-hidden />
        <span className="junk label-mono text-ink/40">— 1 —</span>
      </div>
    </article>
  );
}

function StepBadge({
  step,
  label,
  note,
  className = "",
  inline = false,
}: {
  step: string;
  label: string;
  note: string;
  className?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={`${inline ? "" : "absolute bottom-[10vh] left-1/2 -translate-x-1/2"} flex items-center gap-3 ${className}`}
    >
      <span className="label-mono flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 text-gold">
        {step}
      </span>
      <span className="font-display text-lg text-paper">{label}</span>
      <span className="step-note hidden max-w-xs text-sm text-paper/50 sm:block">{note}</span>
    </div>
  );
}

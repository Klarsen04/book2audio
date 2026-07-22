"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";
import TypeWriter from "@/components/TypeWriter";
import MagneticButton from "@/components/MagneticButton";
import MiniSpectrum from "@/components/MiniSpectrum";
import TiltCard from "@/components/TiltCard";

function AudioSample({
  src,
  label,
  sublabel,
}: {
  src: string;
  label: string;
  sublabel: string;
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
    <div className={`glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.05] transition-all group ${playing ? "border-purple-500/30 bg-purple-500/5" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={`relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shrink-0 hover:scale-110 transition-transform active:scale-95 ${playing ? "pulse-ring" : ""}`}
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        <p className="text-xs text-gray-500">{sublabel}</p>
        {playing ? (
          <MiniSpectrum isPlaying={playing} barCount={16} />
        ) : (
          <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/library");
    }
  }, [user, loading, router]);

  if (loading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <ParticleField />
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px] animate-float" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-emerald-600/8 blur-[100px] animate-float" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-xl font-bold gradient-text">Book2Audio</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm px-5 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6">
        <section className="pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 text-sm text-gray-300"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Free & open source
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Listen to your{" "}
              <span className="gradient-text">
                <TypeWriter words={["books", "PDFs", "papers", "notes", "docs"]} />
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
              Upload any document and transform it into a high-quality audiobook with
              AI voices that sound human. Free, no ads, no limits.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <MagneticButton
                onClick={() => { window.location.href = "/register"; }}
                className="px-8 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-base hover:from-purple-500 hover:to-blue-500 transition-all hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] animate-gradient bg-[length:200%_200%]"
              >
                Add your first book
              </MagneticButton>
              <a
                href="#demo"
                className="px-8 py-3.5 rounded-full text-gray-300 font-medium text-base hover:text-white transition-colors"
              >
                Hear a demo →
              </a>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="mt-16 flex justify-center"
          >
            <a href="#demo" className="scroll-indicator text-gray-600 hover:text-gray-400 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
          </motion.div>
        </section>

        {/* Supported Formats */}
        <section className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Works with your documents
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Drop in whatever you're reading. We handle the rest.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto"
          >
            {[
              { icon: "📕", label: "PDF", desc: "Books & papers" },
              { icon: "📗", label: "EPUB", desc: "E-books" },
              { icon: "📘", label: "DOCX", desc: "Word documents" },
              { icon: "📄", label: "TXT", desc: "Plain text" },
            ].map((fmt, i) => (
              <motion.div
                key={fmt.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="glass rounded-2xl p-6 text-center hover:bg-white/[0.05] transition-all group"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{fmt.icon}</div>
                <p className="font-semibold text-white text-sm">{fmt.label}</p>
                <p className="text-xs text-gray-500 mt-1">{fmt.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How It Works */}
        <section className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Three steps to your audiobook
            </h2>
            <p className="text-gray-400">No complicated setup. Just upload and listen.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                num: "01",
                title: "Upload",
                desc: "Drag & drop your PDF, EPUB, DOCX, or TXT file. We automatically detect chapters and structure.",
                icon: "📤",
              },
              {
                num: "02",
                title: "Choose a voice",
                desc: "Pick from dozens of natural AI voices. Preview them before converting — find the one that fits your book.",
                icon: "🎙️",
              },
              {
                num: "03",
                title: "Listen",
                desc: "Your audiobook is ready. Play in-browser with speed control, sleep timer, and chapter navigation.",
                icon: "🎧",
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative glass rounded-2xl p-8 hover:bg-white/[0.05] transition-all group"
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="text-4xl group-hover:scale-110 transition-transform">{step.icon}</span>
                  <span className="text-3xl font-bold text-white/[0.06] font-mono group-hover:text-white/[0.12] transition-colors">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Voice Demos */}
        <section id="demo" className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Hear the voices
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Natural-sounding AI voices that bring your books to life.
              Press play to hear each one.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto"
          >
            <AudioSample
              src="/samples/voice-jenny.mp3"
              label="Jenny"
              sublabel="Warm & expressive · Fiction"
            />
            <AudioSample
              src="/samples/voice-guy.mp3"
              label="Guy"
              sublabel="Deep & authoritative · Science"
            />
            <AudioSample
              src="/samples/voice-aria.mp3"
              label="Aria"
              sublabel="Clear & friendly · Narration"
            />
            <AudioSample
              src="/samples/voice-andrew.mp3"
              label="Andrew"
              sublabel="Calm & measured · Non-fiction"
            />
          </motion.div>
        </section>

        {/* Sample Books */}
        <section className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Try it yourself
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              These excerpts were converted with Book2Audio. Press play to hear what your books will sound like.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto"
          >
            {[
              {
                src: "/samples/demo-gatsby.mp3",
                title: "The Great Gatsby",
                author: "F. Scott Fitzgerald",
                category: "Fiction",
                voice: "Guy",
                icon: "📖",
              },
              {
                src: "/samples/demo-science.mp3",
                title: "The Structure of DNA",
                author: "Science Textbook",
                category: "Non-fiction",
                voice: "Jenny",
                icon: "🔬",
              },
              {
                src: "/samples/demo-philosophy.mp3",
                title: "The Allegory of the Cave",
                author: "Plato",
                category: "Philosophy",
                voice: "Aria",
                icon: "🏛️",
              },
            ].map((demo) => (
              <DemoCard key={demo.title} {...demo} />
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Built for readers
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Not just text-to-speech. A complete listening experience.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: "Chapter Detection",
                desc: "Automatically splits your book into chapters based on headings, formatting, and structure.",
                icon: "📑",
              },
              {
                title: "Playback Speed",
                desc: "Listen at 0.5x to 3x speed. Perfect for study sessions or long commutes.",
                icon: "⚡",
              },
              {
                title: "Sleep Timer",
                desc: "Set a timer and fall asleep to your book. Audio fades out gently before stopping.",
                icon: "🌙",
              },
              {
                title: "Resume Playback",
                desc: "Pick up exactly where you left off. Your position is saved automatically.",
                icon: "🔖",
              },
              {
                title: "Reader View",
                desc: "Follow along with the text while you listen. Select any passage to play from there.",
                icon: "👁️",
              },
              {
                title: "Your Library",
                desc: "All your converted books in one place. Organized, searchable, and always accessible.",
                icon: "📚",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <TiltCard className="glass rounded-2xl p-6 hover:bg-white/[0.05] transition-all group h-full">
                  <div className="text-3xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform inline-block">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Why Book2Audio?
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              See how we compare to other audiobook solutions.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-3xl mx-auto glass rounded-2xl overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-4 text-gray-400 font-medium">Feature</th>
                  <th className="p-4 text-center text-purple-300 font-semibold">Book2Audio</th>
                  <th className="p-4 text-center text-gray-500 font-medium">Audible</th>
                  <th className="p-4 text-center text-gray-500 font-medium">Generic TTS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Your own documents", us: true, audible: false, tts: true },
                  { feature: "Natural AI voices", us: true, audible: true, tts: false },
                  { feature: "Chapter detection", us: true, audible: true, tts: false },
                  { feature: "Free to use", us: true, audible: false, tts: true },
                  { feature: "Resume playback", us: true, audible: true, tts: false },
                  { feature: "Speed control", us: true, audible: true, tts: false },
                  { feature: "Reader view", us: true, audible: false, tts: false },
                  { feature: "No subscription", us: true, audible: false, tts: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.03] last:border-0">
                    <td className="p-4 text-gray-300">{row.feature}</td>
                    <td className="p-4 text-center">
                      {row.us ? <span className="text-emerald-400">✓</span> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      {row.audible ? <span className="text-gray-400">✓</span> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      {row.tts ? <span className="text-gray-400">✓</span> : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="py-20 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Frequently asked questions
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-2xl mx-auto space-y-3"
          >
            {[
              {
                q: "Is it really free?",
                a: "Yes. Book2Audio is open source and free to use. There are no ads, no subscription, and no hidden limits.",
              },
              {
                q: "What file formats are supported?",
                a: "PDF, EPUB, DOCX, and TXT files. We automatically detect chapters and structure from headings and formatting.",
              },
              {
                q: "How long does conversion take?",
                a: "Typically 1-3 minutes for a full book, depending on length. A 200-page book usually takes about 2 minutes.",
              },
              {
                q: "Are the voices realistic?",
                a: "We use Microsoft's neural voice engine which produces natural-sounding speech with proper intonation and rhythm. Press play above to hear for yourself.",
              },
              {
                q: "Is my data private?",
                a: "Your books are stored securely and never shared with third parties. You can delete your data at any time.",
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="glass rounded-xl group"
              >
                <summary className="flex items-center justify-between p-5 cursor-pointer text-white font-medium text-sm hover:text-purple-200 transition-colors list-none">
                  {faq.q}
                  <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </motion.div>
        </section>

        {/* Final CTA */}
        <section className="py-24 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to listen?
            </h2>
            <p className="text-gray-400 mb-8">
              Upload your first book and have an audiobook in minutes. No credit card, no catch.
            </p>
            <Link
              href="/register"
              className="inline-flex px-8 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-base hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] active:scale-[0.98]"
            >
              Add your first book
            </Link>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-white/[0.04] text-center">
          <p className="text-sm text-gray-600">
            Open source · Privacy-first · No data sold to third parties
          </p>
        </footer>
      </main>
    </div>
  );
}

function DemoCard({
  src,
  title,
  author,
  category,
  voice,
  icon,
}: {
  src: string;
  title: string;
  author: string;
  category: string;
  voice: string;
  icon: string;
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
    <div className="glass rounded-2xl p-6 hover:bg-white/[0.05] transition-all group">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{icon}</span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-gray-400 border border-white/[0.06]">
          {category}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-1">{author}</p>
      <p className="text-xs text-gray-600 mb-4">Voice: {voice}</p>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shrink-0 hover:scale-110 transition-transform active:scale-95"
        >
          {playing ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

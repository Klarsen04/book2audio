"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "@/lib/api";

export default function SettingsPage() {
  const [defaultSpeed, setDefaultSpeed] = useState(1);
  const [defaultVoice, setDefaultVoice] = useState("Joanna");
  const [autoScroll, setAutoScroll] = useState(true);
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedCopied, setFeedCopied] = useState(false);

  useEffect(() => {
    api
      .get("/api/session/feed")
      .then((res) => setFeedUrl(res.data.feed_url))
      .catch(() => setFeedUrl(null)); // no session yet → nothing to show
  }, []);

  useEffect(() => {
    const speed = localStorage.getItem("playback_speed");
    if (speed) setDefaultSpeed(parseFloat(speed));
    const voice = localStorage.getItem("default_voice");
    if (voice) setDefaultVoice(voice);
    const scroll = localStorage.getItem("auto_scroll");
    if (scroll !== null) setAutoScroll(scroll === "true");
    const dyslexia = localStorage.getItem("dyslexia_mode");
    if (dyslexia !== null) setDyslexiaMode(dyslexia === "true");
  }, []);

  const handleSave = () => {
    localStorage.setItem("playback_speed", String(defaultSpeed));
    localStorage.setItem("default_voice", defaultVoice);
    localStorage.setItem("auto_scroll", String(autoScroll));
    localStorage.setItem("dyslexia_mode", String(dyslexiaMode));
    if (dyslexiaMode) {
      document.documentElement.classList.add("dyslexia-mode");
    } else {
      document.documentElement.classList.remove("dyslexia-mode");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-10">
        <p className="label-mono text-gold">Preferences</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-paper">Settings</h1>
        <p className="mt-2 font-serif text-paper/60">Configure your listening preferences.</p>
      </div>

      <div className="space-y-px overflow-hidden rounded-sm border border-hairline bg-hairline">
        {/* Playback speed */}
        <div className="bg-surface p-6">
          <h3 className="label-mono mb-4 text-paper/50">Default playback speed</h3>
          <div className="grid grid-cols-5 gap-2">
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((s) => (
              <button
                key={s}
                onClick={() => setDefaultSpeed(s)}
                className={`label-mono rounded-sm px-3 py-2 transition-all ${
                  defaultSpeed === s
                    ? "border border-gold/40 bg-gold/10 text-gold"
                    : "border border-hairline text-paper/50 hover:bg-surface-hover"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Default voice */}
        <div className="bg-surface p-6">
          <h3 className="label-mono mb-4 text-paper/50">Default voice</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["Joanna", "Matthew", "Amy", "Brian", "Ruth", "Stephen", "Danielle", "Gregory"].map((v) => (
              <button
                key={v}
                onClick={() => setDefaultVoice(v)}
                className={`rounded-sm px-4 py-3 font-serif transition-all ${
                  defaultVoice === v
                    ? "border border-gold/40 bg-gold/10 text-gold"
                    : "border border-hairline text-paper/60 hover:bg-surface-hover"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Reading preferences */}
        <div className="bg-surface p-6">
          <h3 className="label-mono mb-4 text-paper/50">Reading preferences</h3>
          <div className="space-y-5">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="font-display text-lg text-paper">Auto-scroll reader</p>
                <p className="font-serif text-sm text-paper/50">Automatically scroll to the current paragraph while listening</p>
              </div>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  autoScroll ? "bg-gold" : "bg-paper/15"
                }`}
              >
                <div
                  className={`absolute top-1 h-4 w-4 rounded-full transition-transform ${
                    autoScroll ? "left-6 bg-ink" : "left-1 bg-paper"
                  }`}
                />
              </button>
            </label>

            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="font-display text-lg text-paper">Dyslexia-friendly reader</p>
                <p className="font-serif text-sm text-paper/50">Wider spacing, larger text, and a dyslexia-optimized font</p>
              </div>
              <button
                onClick={() => setDyslexiaMode(!dyslexiaMode)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  dyslexiaMode ? "bg-gold" : "bg-paper/15"
                }`}
              >
                <div
                  className={`absolute top-1 h-4 w-4 rounded-full transition-transform ${
                    dyslexiaMode ? "left-6 bg-ink" : "left-1 bg-paper"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Listen in a podcast app */}
        {feedUrl && (
          <div className="bg-surface p-6">
            <h3 className="label-mono mb-2 text-paper/50">Listen in a podcast app</h3>
            <p className="mb-4 font-serif text-sm leading-relaxed text-paper/60">
              Your converted audiobooks are also a private podcast feed. Paste this
              URL into Overcast, Apple Podcasts, Pocket Casts, or any podcast app to
              listen with background play, offline downloads, and car support.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-sm border border-hairline bg-ink px-3 py-2 font-mono text-xs text-paper">
                {feedUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(feedUrl);
                  setFeedCopied(true);
                  setTimeout(() => setFeedCopied(false), 1500);
                }}
                className="label-mono shrink-0 rounded-sm bg-gold px-4 py-2 text-ink"
              >
                {feedCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 label-mono text-paper/40">
              Keep this link private — anyone with it can hear your library.
            </p>
          </div>
        )}

        {/* Data & retention */}
        <div className="bg-surface p-6">
          <h3 className="label-mono mb-4 text-paper/50">Your data</h3>
          <div className="space-y-3 font-serif text-sm leading-relaxed text-paper/60">
            <p>
              There are no accounts — your{" "}
              <span className="text-paper/80">restore key</span> is how you return
              to your library. Keep it somewhere safe; it&apos;s the only way back.
            </p>
            <p className="text-paper/70">
              To keep storage free for everyone, a library with{" "}
              <span className="text-gold">no activity for 30 days</span> is
              automatically deleted — its books and audio are permanently removed.
              Opening the app or playing something counts as activity and resets
              the clock.
            </p>
            <p className="text-paper/50">
              Want a copy regardless? Use <span className="text-paper/70">Export</span>{" "}
              in your library to download all your audiobooks as a .zip.
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="mt-6 w-full rounded-sm bg-gold py-3.5 font-display text-lg text-ink transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        {saved ? "✓ Saved" : "Save settings"}
      </button>
    </motion.div>
  );
}

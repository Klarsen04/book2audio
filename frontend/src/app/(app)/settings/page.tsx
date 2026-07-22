"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [defaultSpeed, setDefaultSpeed] = useState(1);
  const [defaultVoice, setDefaultVoice] = useState("Joanna");
  const [autoScroll, setAutoScroll] = useState(true);
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [saved, setSaved] = useState(false);

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your listening preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Playback speed */}
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Default Playback Speed</h3>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((s) => (
              <button
                key={s}
                onClick={() => setDefaultSpeed(s)}
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${
                  defaultSpeed === s
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Default voice */}
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Default Voice</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["Joanna", "Matthew", "Amy", "Brian", "Ruth", "Stephen", "Danielle", "Gregory"].map((v) => (
              <button
                key={v}
                onClick={() => setDefaultVoice(v)}
                className={`px-4 py-3 text-sm rounded-xl font-medium transition-all ${
                  defaultVoice === v
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Reading preferences */}
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Reading Preferences</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-gray-300">Auto-scroll reader</p>
                <p className="text-xs text-gray-500">Automatically scroll to the current paragraph while listening</p>
              </div>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  autoScroll ? "bg-purple-600" : "bg-white/[0.1]"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoScroll ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-gray-300">Dyslexia-friendly reader</p>
                <p className="text-xs text-gray-500">Wider spacing, larger text, and a dyslexia-optimized font</p>
              </div>
              <button
                onClick={() => setDyslexiaMode(!dyslexiaMode)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  dyslexiaMode ? "bg-purple-600" : "bg-white/[0.1]"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    dyslexiaMode ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          {saved ? "✓ Saved" : "Save Settings"}
        </button>
      </div>
    </motion.div>
  );
}

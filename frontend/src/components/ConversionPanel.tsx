"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

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

  const estimatedMinutes = Math.ceil(wordCount / 150);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
        ← Upload a different file
      </button>

      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-1">{title}</h2>
        <div className="flex gap-4 text-sm text-gray-400 mb-4">
          <span>{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</span>
          <span>{wordCount.toLocaleString()} words</span>
          <span>~{estimatedMinutes} min audio</span>
        </div>

        <div className="border border-gray-800 rounded-lg max-h-48 overflow-y-auto">
          {chapters.map((ch, i) => (
            <div key={i} className="flex justify-between px-4 py-2 border-b border-gray-800 last:border-0">
              <span className="text-gray-300 text-sm">{ch.title}</span>
              <span className="text-gray-500 text-xs">{ch.word_count.toLocaleString()} words</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Voice</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {voices.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              disabled={isConverting}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedVoice === voice.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              } disabled:opacity-50`}
            >
              {voice.id}
              <span className="block text-xs opacity-60">{voice.gender}</span>
            </button>
          ))}
        </div>
      </div>

      {isConverting ? (
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">
              Converting chapter {currentChapter} of {chapters.length}...
            </span>
            <span className="text-purple-400">{progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This may take a few minutes depending on book length.
          </p>
        </div>
      ) : (
        <button
          onClick={handleConvert}
          disabled={!!error}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-medium text-lg hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50"
        >
          Convert to Audiobook
        </button>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import api from "@/lib/api";
import SleepTimer from "./SleepTimer";
import PlaybackSpeed from "./PlaybackSpeed";

interface Props {
  docId: string;
  title: string;
  chapters: { title: string; word_count: number }[];
}

export default function AudioPlayer({ docId, title, chapters }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const lastSavedPosition = useRef(0);

  const audioUrl = `/api/download/${docId}`;

  // Load saved position on mount
  useEffect(() => {
    api.get(`/api/playback/${docId}/position`).then((res) => {
      const saved = res.data.position;
      if (saved > 0 && audioRef.current) {
        audioRef.current.currentTime = saved;
        setCurrentTime(saved);
      }
      lastSavedPosition.current = saved;
      setPositionLoaded(true);
    }).catch(() => setPositionLoaded(true));
  }, [docId]);

  // Load saved speed from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("playback_speed");
    if (saved) {
      const s = parseFloat(saved);
      setSpeed(s);
      if (audioRef.current) audioRef.current.playbackRate = s;
    }
  }, []);

  // Save position every 5 seconds while playing
  const savePosition = useCallback(
    (time: number) => {
      if (Math.abs(time - lastSavedPosition.current) > 2) {
        lastSavedPosition.current = time;
        api.put(`/api/playback/${docId}/position`, { position: time }).catch(() => {});
      }
    },
    [docId]
  );

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (audioRef.current) {
        savePosition(audioRef.current.currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, savePosition]);

  // Save position on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (audioRef.current) {
        navigator.sendBeacon(
          `/api/playback/${docId}/position`,
          JSON.stringify({ position: audioRef.current.currentTime })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && audioRef.current) {
        savePosition(audioRef.current.currentTime);
      }
    });
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [docId, savePosition]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration);
      // Seek to saved position after metadata loads
      if (positionLoaded && lastSavedPosition.current > 0) {
        audio.currentTime = lastSavedPosition.current;
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      savePosition(audio.currentTime);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [positionLoaded, savePosition]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      savePosition(audio.currentTime);
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
    localStorage.setItem("playback_speed", String(newSpeed));
  };

  const handleSleepEnd = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      savePosition(audioRef.current.currentTime);
    }
  };

  const handleFadeStart = () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const startVolume = audio.volume;
    const fadeInterval = setInterval(() => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - startVolume / 30);
      } else {
        clearInterval(fadeInterval);
        audio.volume = startVolume;
      }
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎧</div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} &middot; {formatTime(duration)}
          </p>
        </div>

        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button onClick={() => skip(-30)} className="text-gray-400 hover:text-white transition-colors" title="Back 30s">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={() => skip(30)} className="text-gray-400 hover:text-white transition-colors" title="Forward 30s">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          <SleepTimer onTimerEnd={handleSleepEnd} onFadeStart={handleFadeStart} />
          <PlaybackSpeed speed={speed} onChange={handleSpeedChange} />
        </div>
      </div>

      <a
        href={audioUrl}
        download
        className="block w-full py-3 text-center bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-all"
      >
        Download MP3
      </a>

      {chapters.length > 1 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Chapters</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {chapters.map((ch, i) => (
              <div key={i} className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
                {ch.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

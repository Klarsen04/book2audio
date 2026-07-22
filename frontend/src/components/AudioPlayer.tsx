"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import api from "@/lib/api";
import SleepTimer from "./SleepTimer";
import PlaybackSpeed from "./PlaybackSpeed";
import Waveform from "./Waveform";
import GradientBorder from "./GradientBorder";
import { showToast } from "./Toast";

interface Props {
  docId: string;
  title: string;
  chapters: { title: string; word_count: number }[];
  seekTarget?: number | null;
  onSeekHandled?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onTimeUpdate?: (time: number) => void;
}

export default function AudioPlayer({
  docId,
  title,
  chapters,
  seekTarget,
  onSeekHandled,
  onPlayingChange,
  onTimeUpdate,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const lastSavedPosition = useRef(0);

  const audioUrl = `/api/download/${docId}`;

  useEffect(() => {
    if (seekTarget !== null && seekTarget !== undefined && audioRef.current) {
      audioRef.current.currentTime = seekTarget;
      setCurrentTime(seekTarget);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
        onPlayingChange?.(true);
      }
      onSeekHandled?.();
    }
  }, [seekTarget]);

  useEffect(() => {
    api
      .get(`/api/playback/${docId}/position`)
      .then((res) => {
        const saved = res.data.position;
        if (saved > 0 && audioRef.current) {
          audioRef.current.currentTime = saved;
          setCurrentTime(saved);
        }
        lastSavedPosition.current = saved;
        setPositionLoaded(true);
      })
      .catch(() => setPositionLoaded(true));
  }, [docId]);

  useEffect(() => {
    const saved = localStorage.getItem("playback_speed");
    if (saved) {
      const s = parseFloat(saved);
      setSpeed(s);
      if (audioRef.current) audioRef.current.playbackRate = s;
    }
    const savedVol = localStorage.getItem("playback_volume");
    if (savedVol) {
      const v = parseFloat(savedVol);
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
    }
  }, []);

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

  useEffect(() => {
    const handleUnload = () => {
      if (audioRef.current) {
        navigator.sendBeacon(
          `/api/playback/${docId}/position`,
          JSON.stringify({ position: audioRef.current.currentTime })
        );
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && audioRef.current) {
        savePosition(audioRef.current.currentTime);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [docId, savePosition]);

  // Media Session API for system media controls (lock screen, headphones)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "Book2Audio",
      album: `${chapters.length} chapters`,
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play();
      setIsPlaying(true);
      onPlayingChange?.(true);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
      setIsPlaying(false);
      onPlayingChange?.(false);
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-30));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));
  }, [title, chapters.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
      if (loopA !== null && loopB !== null && audio.currentTime >= loopB) {
        audio.currentTime = loopA;
      }
    };
    const updateDuration = () => {
      setDuration(audio.duration);
      if (positionLoaded && lastSavedPosition.current > 0) {
        audio.currentTime = lastSavedPosition.current;
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onPlayingChange?.(false);
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
  }, [positionLoaded, savePosition, onTimeUpdate, onPlayingChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          showToast(isPlaying ? "⏸ Paused" : "▶ Playing");
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(e.shiftKey ? -10 : -30);
          showToast(`⏪ -${e.shiftKey ? "10" : "30"}s`);
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(e.shiftKey ? 10 : 30);
          showToast(`⏩ +${e.shiftKey ? "10" : "30"}s`);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          showToast(`🔊 ${Math.round(Math.min(1, volume + 0.1) * 100)}%`);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          showToast(`🔉 ${Math.round(Math.max(0, volume - 0.1) * 100)}%`);
          break;
        case "KeyM":
          e.preventDefault();
          handleVolumeChange(volume === 0 ? 1 : 0);
          showToast(volume === 0 ? "🔊 Unmuted" : "🔇 Muted");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume]);

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
    onPlayingChange?.(!isPlaying);
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

  const handleVolumeChange = (newVol: number) => {
    const v = Math.round(newVol * 10) / 10;
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    localStorage.setItem("playback_volume", String(v));
  };

  const handleSleepEnd = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayingChange?.(false);
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

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${title}.mp3`;
    a.click();
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setHoverTime(x * duration);
    setHoverX(e.clientX - rect.left);
  };

  const playerContent = (
    <div className="p-6">
      {/* Title section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 flex items-center justify-center text-2xl shrink-0">
            🎧
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
              {isPlaying && <Waveform isPlaying={isPlaying} />}
            </div>
            <p className="text-xs text-gray-400">
              {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} · {formatTime(duration)}
            </p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
          title="Download audio"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress bar */}
      <div className="mb-6">
        <div
          className="relative group"
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full relative z-10 opacity-0 cursor-pointer h-6"
          />
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-white/[0.08] overflow-hidden pointer-events-none group-hover:h-2 transition-all">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-[width] duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_8px_rgba(139,92,246,0.5)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
          {hoverTime !== null && (
            <div
              className="absolute -top-8 px-2 py-1 glass-strong rounded text-[10px] text-white pointer-events-none -translate-x-1/2 transition-opacity"
              style={{ left: hoverX }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SleepTimer onTimerEnd={handleSleepEnd} onFadeStart={handleFadeStart} />
          {/* A-B Loop */}
          <button
            onClick={() => {
              if (loopA === null) {
                setLoopA(currentTime);
                showToast(`Loop A set at ${formatTime(currentTime)}`);
              } else if (loopB === null) {
                setLoopB(currentTime);
                showToast(`Looping ${formatTime(loopA)} → ${formatTime(currentTime)}`);
              } else {
                setLoopA(null);
                setLoopB(null);
                showToast("Loop cleared");
              }
            }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              loopA !== null
                ? "bg-orange-600/20 text-orange-300 border border-orange-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
            }`}
            title={loopA === null ? "Set loop start (A)" : loopB === null ? "Set loop end (B)" : "Clear loop"}
          >
            <span className="font-bold">A-B</span>
            {loopA !== null && loopB === null && <span className="text-[10px]">A✓</span>}
            {loopA !== null && loopB !== null && <span className="text-[10px]">∞</span>}
          </button>
          {/* Volume */}
          <div className="relative">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Volume"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                {volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : volume < 0.5 ? (
                  <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            {showVolume && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 glass-strong rounded-xl p-3 shadow-2xl">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-24 h-1"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={() => skip(-30)}
            className="text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95"
            title="Back 30s (← or Shift+← for 10s)"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>

          <div className="relative">
            {/* Progress ring */}
            <svg className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90">
              <circle
                cx="50%" cy="50%" r="30"
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2"
              />
              <circle
                cx="50%" cy="50%" r="30"
                fill="none" stroke="url(#progress-gradient)" strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - progressPercent / 100)}`}
                className="transition-all duration-300"
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
            </svg>
            <button
              onClick={togglePlay}
              className="relative w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-110 hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] active:scale-95"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          <button
            onClick={() => skip(30)}
            className="text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95"
            title="Forward 30s (→ or Shift+→ for 10s)"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
          </button>
        </div>

        <PlaybackSpeed speed={speed} onChange={handleSpeedChange} />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-4 pt-4 border-t border-white/[0.04] hidden sm:flex items-center justify-center gap-4 text-[11px] text-gray-600">
        <span>Space: play/pause</span>
        <span>←/→: skip 30s</span>
        <span>↑/↓: volume</span>
        <span>M: mute</span>
      </div>
    </div>
  );

  if (isPlaying) {
    return <GradientBorder animate>{playerContent}</GradientBorder>;
  }

  return <div className="glass-strong rounded-2xl">{playerContent}</div>;
}

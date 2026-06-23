"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import api from "@/lib/api";
import SleepTimer from "./SleepTimer";
import PlaybackSpeed from "./PlaybackSpeed";

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
  const lastSavedPosition = useRef(0);

  const audioUrl = `/api/download/${docId}`;

  // Handle seek from parent (chapter selection)
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

  // Load saved position on mount
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="text-3xl">🎧</div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-xs text-gray-400">
            {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} &middot; {formatTime(duration)}
          </p>
        </div>
      </div>

      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="mb-3">
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

      <div className="flex items-center justify-between">
        <SleepTimer onTimerEnd={handleSleepEnd} onFadeStart={handleFadeStart} />

        <div className="flex items-center gap-4">
          <button onClick={() => skip(-30)} className="text-gray-400 hover:text-white transition-colors" title="Back 30s">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={() => skip(30)} className="text-gray-400 hover:text-white transition-colors" title="Forward 30s">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
          </button>
        </div>

        <PlaybackSpeed speed={speed} onChange={handleSpeedChange} />
      </div>
    </div>
  );
}

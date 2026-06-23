"use client";

import { useState } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

interface Props {
  speed: number;
  onChange: (speed: number) => void;
}

export default function PlaybackSpeed({ speed, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white transition-colors font-medium"
        title="Playback speed"
      >
        {speed}x
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-gray-800 border border-gray-700 rounded-lg p-2 shadow-xl">
          <div className="grid grid-cols-3 gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s);
                  setIsOpen(false);
                }}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  speed === s
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

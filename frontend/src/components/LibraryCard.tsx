"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Document {
  id: string;
  filename: string;
  title: string;
  format: string;
  total_word_count: number;
  status: string;
  audio_duration: number | null;
  created_at: string;
}

interface Props {
  document: Document;
  onDelete: (id: string) => void;
}

const formatIcons: Record<string, string> = {
  pdf: "📕",
  epub: "📗",
  docx: "📘",
  txt: "📄",
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  uploaded: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  converting: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400 animate-pulse" },
  completed: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  error: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function LibraryCard({ document: doc, onDelete }: Props) {
  const status = statusConfig[doc.status] || statusConfig.uploaded;
  const [listenProgress, setListenProgress] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    setIsFavorite(favs.includes(doc.id));
  }, [doc.id]);

  const toggleFavorite = () => {
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    const updated = isFavorite ? favs.filter((id: string) => id !== doc.id) : [...favs, doc.id];
    localStorage.setItem("favorites", JSON.stringify(updated));
    setIsFavorite(!isFavorite);
  };

  useEffect(() => {
    if (doc.status !== "completed" || !doc.audio_duration) return;
    api
      .get(`/api/playback/${doc.id}/position`)
      .then((res) => {
        const pos = res.data.position;
        if (pos > 0 && doc.audio_duration) {
          setListenProgress(Math.min(100, (pos / doc.audio_duration) * 100));
        }
      })
      .catch(() => {});
  }, [doc.id, doc.status, doc.audio_duration]);

  return (
    <div className="group glass rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
      <div>
        <div className="flex items-start justify-between mb-4">
          <span className="text-3xl">{formatIcons[doc.format] || "📄"}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.preventDefault(); toggleFavorite(); }}
              className={`transition-all ${isFavorite ? "text-amber-400 scale-110" : "text-gray-600 opacity-0 group-hover:opacity-100 hover:text-amber-400"}`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {doc.status}
            </span>
          </div>
        </div>
        <h3 className="font-semibold text-white text-sm line-clamp-2 mb-2 group-hover:text-white/95">
          {doc.title}
        </h3>
        <p className="text-xs text-gray-500">
          {doc.total_word_count.toLocaleString()} words
          {doc.audio_duration && ` · ${formatDuration(doc.audio_duration)}`}
        </p>
        <p className="text-[10px] text-gray-600 mt-1">{timeAgo(doc.created_at)}</p>

        {/* Listening progress bar */}
        {listenProgress !== null && listenProgress > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">
                {listenProgress >= 95 ? "Finished" : `${Math.round(listenProgress)}% listened`}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                style={{ width: `${listenProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-5">
        {doc.status === "completed" ? (
          <Link
            href={`/player/${doc.id}`}
            className="flex-1 text-center py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:shadow-[0_0_15px_rgba(139,92,246,0.2)]"
          >
            {listenProgress && listenProgress > 0 && listenProgress < 95 ? "Continue" : "Play"}
          </Link>
        ) : doc.status === "uploaded" ? (
          <Link
            href={`/convert?doc=${doc.id}`}
            className="flex-1 text-center py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-gray-300 hover:bg-white/[0.1] hover:text-white transition-all"
          >
            Convert
          </Link>
        ) : (
          <span className="flex-1 text-center py-2 text-gray-500 text-sm">
            {doc.status === "converting" ? "Converting..." : "Failed"}
          </span>
        )}
        <button
          onClick={() => onDelete(doc.id)}
          className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

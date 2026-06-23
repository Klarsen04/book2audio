"use client";

import Link from "next/link";

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

const statusColors: Record<string, string> = {
  uploaded: "bg-yellow-900/50 text-yellow-400",
  converting: "bg-blue-900/50 text-blue-400",
  completed: "bg-green-900/50 text-green-400",
  error: "bg-red-900/50 text-red-400",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LibraryCard({ document: doc, onDelete }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 flex flex-col justify-between hover:bg-gray-800/80 transition-colors">
      <div>
        <div className="flex items-start justify-between mb-2">
          <span className="text-2xl">{formatIcons[doc.format] || "📄"}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[doc.status]}`}>
            {doc.status}
          </span>
        </div>
        <h3 className="font-medium text-white text-sm line-clamp-2 mb-1">{doc.title}</h3>
        <p className="text-xs text-gray-500">
          {doc.total_word_count.toLocaleString()} words
          {doc.audio_duration && ` · ${formatDuration(doc.audio_duration)}`}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {doc.status === "completed" ? (
          <Link
            href={`/player/${doc.id}`}
            className="flex-1 text-center py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-medium hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            Play
          </Link>
        ) : doc.status === "uploaded" ? (
          <Link
            href={`/convert?doc=${doc.id}`}
            className="flex-1 text-center py-1.5 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            Convert
          </Link>
        ) : (
          <span className="flex-1 text-center py-1.5 text-gray-500 text-sm">
            {doc.status === "converting" ? "Converting..." : "Failed"}
          </span>
        )}
        <button
          onClick={() => onDelete(doc.id)}
          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
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

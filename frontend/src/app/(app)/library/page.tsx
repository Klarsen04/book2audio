"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import LibraryCard from "@/components/LibraryCard";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";

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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "uploaded" | "converting" | "favorites">("all");
  const [search, setSearch] = useState("");

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/api/library");
      setDocuments(res.data.documents);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document and its audio?")) return;
    await api.delete(`/api/library/${docId}`);
    setDocuments((docs) => docs.filter((d) => d.id !== docId));
  };

  const favorites: string[] = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("favorites") || "[]")
    : [];

  const filteredDocs = documents
    .filter((d) => {
      if (filter === "favorites") return favorites.includes(d.id);
      return filter === "all" || d.status === filter;
    })
    .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stats = {
    total: documents.length,
    completed: documents.filter((d) => d.status === "completed").length,
    totalDuration: documents.reduce((sum, d) => sum + (d.audio_duration || 0), 0),
    totalWords: documents.reduce((sum, d) => sum + d.total_word_count, 0),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length} {documents.length === 1 ? "book" : "books"}
          </p>
        </div>
        <Link
          href="/convert"
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] active:scale-[0.98]"
        >
          + New Book
        </Link>
      </div>

      {/* Search */}
      {documents.length > 2 && (
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your library..."
              className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-gray-500 focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 focus:outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Stats bar */}
      {documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Books", value: stats.total, icon: "📚", suffix: "" },
            { label: "Converted", value: stats.completed, icon: "✅", suffix: "" },
            { label: "Audio (min)", value: stats.totalDuration > 0 ? Math.floor(stats.totalDuration / 60) : 0, icon: "🎧", suffix: "m" },
            { label: "Words", value: stats.totalWords > 0 ? Math.floor(stats.totalWords / 1000) : 0, icon: "📝", suffix: "k" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="glass rounded-xl p-4 text-center hover-lift"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-lg font-bold text-white">
                {stat.value > 0 ? <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={1.5} /> : "—"}
              </div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Filter tabs */}
      {documents.length > 1 && (
        <div className="flex gap-2 mb-6">
          {(["all", "favorites", "completed", "uploaded", "converting"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && (
                <span className="ml-1.5 opacity-60">
                  {f === "favorites"
                    ? favorites.length
                    : documents.filter((d) => d.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {documents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center py-24 glass rounded-2xl"
        >
          <div className="text-6xl mb-6">📚</div>
          <h2 className="text-xl font-semibold text-white mb-2">Your library is empty</h2>
          <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">
            Upload a book to convert it into an audiobook you can listen to anywhere.
          </p>
          <Link
            href="/convert"
            className="inline-flex px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-105 active:scale-[0.98]"
          >
            Upload your first book
          </Link>
        </motion.div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl">
          <p className="text-gray-400">No books with status &ldquo;{filter}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredDocs.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <LibraryCard document={doc} onDelete={handleDelete} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import LibraryCard from "@/components/LibraryCard";

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

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="text-gray-400 text-center py-12">Loading your library...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Your Library</h1>
        <Link
          href="/convert"
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-medium hover:from-purple-500 hover:to-blue-500 transition-all"
        >
          + New Book
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 rounded-xl">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-gray-400 text-lg">Your library is empty</p>
          <p className="text-gray-500 text-sm mt-1">Upload a book to get started</p>
          <Link
            href="/convert"
            className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-medium hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            Upload your first book
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <LibraryCard key={doc.id} document={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

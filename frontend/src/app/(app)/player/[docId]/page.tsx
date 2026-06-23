"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import AudioPlayer from "@/components/AudioPlayer";

interface Document {
  id: string;
  title: string;
  filename: string;
  chapters: { title: string; word_count: number }[];
  audio_duration: number | null;
  status: string;
}

export default function PlayerPage() {
  const params = useParams();
  const docId = params.docId as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/library/${docId}`)
      .then((res) => setDocument(res.data.document))
      .catch(() => setError("Document not found"))
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) return <p className="text-gray-400 text-center py-12">Loading...</p>;
  if (error) return <p className="text-red-400 text-center py-12">{error}</p>;
  if (!document) return null;

  if (document.status !== "completed") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">This document hasn&apos;t been converted yet.</p>
        <Link href="/library" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-6">
        ← Back to library
      </Link>
      <AudioPlayer
        docId={docId}
        title={document.title}
        chapters={document.chapters}
      />
    </div>
  );
}

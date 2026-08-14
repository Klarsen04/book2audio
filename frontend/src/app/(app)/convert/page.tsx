"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FileUpload from "@/components/FileUpload";
import ConversionPanel from "@/components/ConversionPanel";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface UploadResult {
  job_id: string;
  title: string;
  chapters: { title: string; word_count: number }[];
  total_word_count: number;
}

export default function ConvertPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [startConverting, setStartConverting] = useState(false);

  useEffect(() => {
    const docId = searchParams.get("doc");
    if (docId) {
      setLoadingDoc(true);
      api
        .get(`/api/library/${docId}`)
        .then((res) => {
          const doc = res.data.document;
          setUploadResult({
            job_id: doc.id,
            title: doc.title,
            chapters: doc.chapters || [],
            total_word_count: doc.chapters?.reduce((s: number, c: any) => s + c.word_count, 0) || 0,
          });
          // Opened from a "Converting…"/"Queued" card → show live progress.
          setStartConverting(doc.status === "converting" || doc.status === "queued");
        })
        .catch(() => {})
        .finally(() => setLoadingDoc(false));
    }
  }, [searchParams]);

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
  };

  const handleConversionComplete = () => {
    router.push(`/player/${uploadResult?.job_id}`);
  };

  if (loadingDoc) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-surface rounded-sm animate-pulse mb-8" />
        <div className="bg-surface border border-hairline rounded-sm h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto"
    >
      <div className="mb-10">
        <p className="label-mono text-gold">New conversion</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-paper">Turn a page into a voice</h1>
        <p className="mt-2 font-serif text-paper/60">
          Upload a document — we detect its chapters, strip the junk, and read it aloud.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!uploadResult ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <FileUpload onUploadComplete={handleUploadComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="convert"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <ConversionPanel
              jobId={uploadResult.job_id}
              title={uploadResult.title}
              chapters={uploadResult.chapters}
              wordCount={uploadResult.total_word_count}
              startConverting={startConverting}
              onConversionComplete={handleConversionComplete}
              onBack={() => {
                setUploadResult(null);
                setStartConverting(false);
                router.replace("/convert");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse mb-8" />
        <div className="glass rounded-2xl h-64 animate-pulse" />
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Convert a Book</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a file and transform it into an audiobook.</p>
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
              onConversionComplete={handleConversionComplete}
              onBack={() => {
                setUploadResult(null);
                router.replace("/convert");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

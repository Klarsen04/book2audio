"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import ConversionPanel from "@/components/ConversionPanel";
import AudioPlayer from "@/components/AudioPlayer";

interface UploadResult {
  job_id: string;
  title: string;
  chapters: { title: string; word_count: number }[];
  total_word_count: number;
}

export default function Home() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isConverted, setIsConverted] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
    setJobId(result.job_id);
    setIsConverted(false);
  };

  const handleConversionComplete = () => {
    setIsConverted(true);
  };

  const handleReset = () => {
    setUploadResult(null);
    setIsConverted(false);
    setJobId(null);
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Book2Audio
          </h1>
          <p className="mt-3 text-gray-400 text-lg">
            Convert your books into high-quality audiobooks
          </p>
        </div>

        {!uploadResult && <FileUpload onUploadComplete={handleUploadComplete} />}

        {uploadResult && !isConverted && (
          <ConversionPanel
            jobId={uploadResult.job_id}
            title={uploadResult.title}
            chapters={uploadResult.chapters}
            wordCount={uploadResult.total_word_count}
            onConversionComplete={handleConversionComplete}
            onBack={handleReset}
          />
        )}

        {isConverted && jobId && (
          <AudioPlayer
            jobId={jobId}
            title={uploadResult?.title || "Audiobook"}
            chapters={uploadResult?.chapters || []}
            onBack={handleReset}
          />
        )}
      </div>
    </main>
  );
}

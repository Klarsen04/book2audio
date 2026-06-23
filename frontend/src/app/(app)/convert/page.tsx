"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/FileUpload";
import ConversionPanel from "@/components/ConversionPanel";

interface UploadResult {
  job_id: string;
  title: string;
  chapters: { title: string; word_count: number }[];
  total_word_count: number;
}

export default function ConvertPage() {
  const router = useRouter();
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
  };

  const handleConversionComplete = () => {
    router.push(`/player/${uploadResult?.job_id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Convert a Book</h1>

      {!uploadResult && <FileUpload onUploadComplete={handleUploadComplete} />}

      {uploadResult && (
        <ConversionPanel
          jobId={uploadResult.job_id}
          title={uploadResult.title}
          chapters={uploadResult.chapters}
          wordCount={uploadResult.total_word_count}
          onConversionComplete={handleConversionComplete}
          onBack={() => setUploadResult(null)}
        />
      )}
    </div>
  );
}

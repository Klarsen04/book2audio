"use client";

import { useState, useRef, DragEvent } from "react";
import api from "@/lib/api";
import { motion } from "framer-motion";

interface Props {
  onUploadComplete: (result: any) => void;
}

export default function FileUpload({ onUploadComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [".pdf", ".epub", ".docx", ".txt"];

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const validateAndSetFile = (f: File) => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.includes(ext)) {
      setError(`Unsupported format. Please upload: ${acceptedTypes.join(", ")}`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSetFile(selected);
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/api/upload", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });
      onUploadComplete(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative glass rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 group ${
          isDragging
            ? "border-purple-500/50 bg-purple-500/5 scale-[1.01]"
            : "hover:bg-white/[0.04] hover:border-white/10 hover:scale-[1.005]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleFileSelect}
          className="hidden"
        />

        <motion.div
          animate={isDragging ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-6xl mb-6"
        >
          📚
        </motion.div>

        <p className="text-lg text-gray-200 font-medium mb-2">
          Drag & drop your book here
        </p>
        <p className="text-sm text-gray-500">
          or <span className="text-purple-400 group-hover:text-purple-300 transition-colors">browse files</span>
        </p>

        <div className="flex items-center justify-center gap-3 mt-6">
          {["PDF", "EPUB", "DOCX", "TXT"].map((fmt) => (
            <span
              key={fmt}
              className="px-3 py-1 text-xs font-medium text-gray-500 bg-white/[0.04] rounded-full border border-white/[0.06]"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {file && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl">
              📄
            </div>
            <div>
              <p className="text-gray-200 font-medium text-sm">{file.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 font-semibold text-sm hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-[0.98]"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {uploadProgress > 0 && uploadProgress < 100
                  ? `Uploading ${uploadProgress}%`
                  : "Analyzing..."}
              </span>
            ) : (
              "Upload & Analyze"
            )}
          </button>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, DragEvent } from "react";
import api from "@/lib/api";
import { motion } from "framer-motion";

type InputMode = "file" | "url" | "text";

interface Props {
  onUploadComplete: (result: any) => void;
}

export default function FileUpload({ onUploadComplete }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
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

  const handleUrlSubmit = async () => {
    if (!urlValue.trim()) return;
    setIsUploading(true);
    setError(null);

    try {
      const response = await api.post("/api/upload-url", { url: urlValue.trim() });
      onUploadComplete(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch URL. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textValue.trim()) return;
    setIsUploading(true);
    setError(null);

    try {
      const response = await api.post("/api/upload-text", { text: textValue.trim(), title: "Pasted text" });
      onUploadComplete(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to convert text. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const tabs: { key: InputMode; label: string }[] = [
    { key: "file", label: "Upload File" },
    { key: "url", label: "Paste URL" },
    { key: "text", label: "Paste Text" },
  ];

  return (
    <div className="space-y-5">
      {/* Input mode tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setInputMode(tab.key); setError(null); }}
            className={`px-4 py-1.5 rounded-full label-mono transition-all ${
              inputMode === tab.key
                ? "bg-gold/10 text-gold border border-gold/30"
                : "text-paper/60 border border-hairline hover:text-paper hover:bg-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* File upload mode */}
      {inputMode === "file" && (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative bg-surface border border-hairline rounded-sm p-16 text-center cursor-pointer transition-all duration-300 group ${
              isDragging
                ? "border-gold/40 bg-gold/5 scale-[1.01]"
                : "hover:bg-surface-hover hover:border-hairline-strong hover:scale-[1.005]"
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

            <p className="text-lg text-paper font-display mb-2">
              Drag & drop your book here
            </p>
            <p className="text-sm text-paper/40 font-serif">
              or <span className="text-gold group-hover:text-gold-soft transition-colors">browse files</span>
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              {["PDF", "EPUB", "DOCX", "TXT"].map((fmt) => (
                <span
                  key={fmt}
                  className="px-3 py-1 label-mono text-paper/40 bg-surface rounded-full border border-hairline"
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
              className="bg-surface-hover border border-hairline-strong rounded-sm p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sm bg-gold/10 flex items-center justify-center text-2xl">
                  📄
                </div>
                <div>
                  <p className="text-paper font-serif text-sm">{file.name}</p>
                  <p className="label-mono text-paper/40 mt-0.5">{formatSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-6 py-2.5 rounded-full bg-gold text-ink font-semibold text-sm hover:bg-gold-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-[0.98]"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/30 border-t-ink animate-spin" />
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
        </>
      )}

      {/* URL input mode */}
      {inputMode === "url" && (
        <div className="bg-surface border border-hairline rounded-sm p-8 space-y-4">
          <div className="flex gap-3">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="Paste a URL to any web article, PDF, or page..."
              className="flex-1 px-5 py-3 bg-surface border border-hairline rounded-sm text-paper text-sm placeholder-paper/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 focus:outline-none transition-all"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={isUploading || !urlValue.trim()}
              className="px-6 py-3 rounded-full bg-gold text-ink font-semibold text-sm hover:bg-gold-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-[0.98] whitespace-nowrap"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-ink/30 border-t-ink animate-spin" />
                  Fetching...
                </span>
              ) : (
                "Fetch & Convert"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Text input mode */}
      {inputMode === "text" && (
        <div className="bg-surface border border-hairline rounded-sm p-8 space-y-4">
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Paste or type text here..."
            rows={8}
            className="w-full px-5 py-4 bg-surface border border-hairline rounded-sm text-paper text-sm placeholder-paper/40 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 focus:outline-none transition-all resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={handleTextSubmit}
              disabled={isUploading || !textValue.trim()}
              className="px-6 py-2.5 rounded-full bg-gold text-ink font-semibold text-sm hover:bg-gold-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-[0.98]"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-ink/30 border-t-ink animate-spin" />
                  Converting...
                </span>
              ) : (
                "Convert Text"
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-burgundy/10 border border-burgundy/30 rounded-sm p-4 text-burgundy-soft text-sm font-serif"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}

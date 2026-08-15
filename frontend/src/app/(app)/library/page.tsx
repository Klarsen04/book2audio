"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import api from "@/lib/api";
import LibraryCard from "@/components/LibraryCard";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import SaveKeyBanner from "@/components/SaveKeyBanner";
import { showToast } from "@/components/Toast";

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

interface Collection {
  id: string;
  name: string;
  doc_ids: string[];
}

type SortOption = "custom" | "recently_played" | "newest" | "oldest";
type ViewMode = "grid" | "list";
type FileTypeFilter = "all" | "pdf" | "docx" | "epub" | "url" | "txt";
type StatusFilter = "all" | "uploaded" | "converting" | "completed" | "error";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("custom");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [documentOrder, setDocumentOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "collection" | "document"; id: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [lastPlayed, setLastPlayed] = useState<Record<string, number>>({});

  // Local last-played timestamps (written by the player page) drive the
  // "Recently played" sort.
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("last_played") || "{}");
      if (parsed && typeof parsed === "object") setLastPlayed(parsed);
    } catch {}
  }, []);

  // Download the whole library as one .zip of MP3s (one file per book).
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await api.get("/api/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "book2audio-library.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      // With responseType "blob" the error body is a Blob — decode it to get
      // the backend's message (e.g. "No completed audiobooks to export yet").
      let message = "Export failed. Please try again.";
      try {
        const data = err.response?.data;
        if (data instanceof Blob) {
          const parsed = JSON.parse(await data.text());
          if (typeof parsed.detail === "string") message = parsed.detail;
        }
      } catch {}
      showToast(message);
    } finally {
      setExporting(false);
    }
  }, []);

  // Load document order from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("doc_order");
    if (stored) {
      try {
        setDocumentOrder(JSON.parse(stored));
      } catch {
        // ignore invalid JSON
      }
    }
  }, []);

  // Persist document order to localStorage
  const saveDocumentOrder = useCallback((order: string[]) => {
    setDocumentOrder(order);
    localStorage.setItem("doc_order", JSON.stringify(order));
  }, []);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, docId: string) => {
    setDraggedId(docId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", docId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      return;
    }

    // Build the current order from filteredDocs if we don't have one stored
    setDocumentOrder((prevOrder) => {
      // Use filteredDocs' IDs as the base order if prevOrder is empty or incomplete
      const currentIds = documents.map((d) => d.id);
      let workingOrder = prevOrder.length > 0
        ? [...prevOrder.filter((id) => currentIds.includes(id)), ...currentIds.filter((id) => !prevOrder.includes(id))]
        : [...currentIds];

      const sourceIndex = workingOrder.indexOf(sourceId);
      const targetIndex = workingOrder.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prevOrder;

      // Remove source and insert at target position
      workingOrder.splice(sourceIndex, 1);
      workingOrder.splice(targetIndex, 0, sourceId);

      localStorage.setItem("doc_order", JSON.stringify(workingOrder));
      return workingOrder;
    });

    setDraggedId(null);
  }, [documents]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  // Load collections from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("book2audio_collections");
    if (stored) {
      try {
        setCollections(JSON.parse(stored));
      } catch {
        // ignore invalid JSON
      }
    }
  }, []);

  // Persist collections to localStorage
  const saveCollections = useCallback((updated: Collection[]) => {
    setCollections(updated);
    localStorage.setItem("book2audio_collections", JSON.stringify(updated));
  }, []);

  const handleNewCollection = () => {
    const name = prompt("Collection name:");
    if (!name || !name.trim()) return;
    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name: name.trim(),
      doc_ids: [],
    };
    saveCollections([...collections, newCollection]);
  };

  const handleDeleteCollection = (collectionId: string) => {
    setConfirmDelete({ type: "collection", id: collectionId });
  };

  const executeDeleteCollection = (collectionId: string) => {
    const updated = collections.filter((c) => c.id !== collectionId);
    saveCollections(updated);
    if (activeCollection === collectionId) {
      setActiveCollection(null);
    }
  };

  const handleAddToCollection = (docId: string, collectionId: string) => {
    const updated = collections.map((c) => {
      if (c.id === collectionId && !c.doc_ids.includes(docId)) {
        return { ...c, doc_ids: [...c.doc_ids, docId] };
      }
      return c;
    });
    saveCollections(updated);
  };

  const handleRemoveFromCollection = (docId: string, collectionId: string) => {
    const updated = collections.map((c) => {
      if (c.id === collectionId) {
        return { ...c, doc_ids: c.doc_ids.filter((id) => id !== docId) };
      }
      return c;
    });
    saveCollections(updated);
  };

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/api/library");
      setDocuments(res.data.documents);
      setFetchError(false);
    } catch {
      // Distinguish "backend unreachable" from "library is empty" — showing
      // the empty state on an outage looks like the library was wiped.
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Clean up stale document IDs from collections after documents load
  useEffect(() => {
    if (documents.length === 0 && loading) return;
    const validIds = new Set(documents.map(d => d.id));
    const needsCleanup = collections.some(c => c.doc_ids.some(id => !validIds.has(id)));
    if (needsCleanup) {
      const cleaned = collections.map(c => ({
        ...c,
        doc_ids: c.doc_ids.filter(id => validIds.has(id))
      }));
      saveCollections(cleaned);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, loading]);

  const handleDelete = (docId: string) => {
    setConfirmDelete({ type: "document", id: docId });
  };

  const executeDeleteDocument = async (docId: string) => {
    await api.delete(`/api/library/${docId}`);
    setDocuments((docs) => docs.filter((d) => d.id !== docId));
  };

  const activeCollectionObj = activeCollection
    ? collections.find((c) => c.id === activeCollection)
    : null;

  const filteredDocs = documents
    .filter((d) => {
      // Collection filter
      if (activeCollectionObj) {
        if (!activeCollectionObj.doc_ids.includes(d.id)) return false;
      }
      // File type filter
      if (fileTypeFilter !== "all") {
        const formatMap: Record<string, string[]> = {
          pdf: ["pdf"],
          docx: ["docx", "doc"],
          epub: ["epub"],
          // URL uploads are stored with format "html"
          url: ["url", "web", "html"],
          txt: ["txt", "text"],
        };
        const allowedFormats = formatMap[fileTypeFilter] || [];
        if (!allowedFormats.includes(d.format?.toLowerCase())) return false;
      }
      // Status filter (case-insensitive to handle backend variations).
      // "In Progress" covers both queued and actively-converting docs.
      if (statusFilter !== "all") {
        const s = d.status?.toLowerCase();
        if (statusFilter === "converting") {
          if (s !== "converting" && s !== "queued") return false;
        } else if (s !== statusFilter) {
          return false;
        }
      }
      return true;
    })
    .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "recently_played": {
          // Timestamps are recorded locally whenever a player page opens.
          const tA = lastPlayed[a.id] ?? 0;
          const tB = lastPlayed[b.id] ?? 0;
          if (tA !== tB) return tB - tA;
          // Never-played docs sort by newest.
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case "custom":
        default:
          if (documentOrder.length > 0) {
            const indexA = documentOrder.indexOf(a.id);
            const indexB = documentOrder.indexOf(b.id);
            // Documents not in the order array go to the end, sorted by newest
            if (indexA === -1 && indexB === -1) {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const stats = {
    total: documents.length,
    completed: documents.filter((d) => d.status === "completed").length,
    totalDuration: documents.reduce((sum, d) => sum + (d.audio_duration || 0), 0),
    totalWords: documents.reduce((sum, d) => sum + d.total_word_count, 0),
  };

  const queueCount = documents.length;

  if (loading) {
    return (
      <div className="flex gap-6 h-full">
        <div className="hidden md:block w-64 shrink-0">
          <div className="bg-surface border border-hairline rounded-sm p-4 h-full animate-pulse" />
        </div>
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 w-40 bg-surface rounded-sm animate-pulse" />
            <div className="h-10 w-28 bg-surface rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface border border-hairline rounded-sm p-6 h-48 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex gap-0 md:gap-6 h-full min-h-[calc(100vh-120px)]"
    >
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 left-6 z-50 md:hidden w-12 h-12 rounded-full bg-gold text-ink flex items-center justify-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] hover:scale-[1.02] transition-transform"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40 w-64 shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:block
          overflow-y-auto
        `}
      >
        <div className="bg-surface border border-hairline rounded-none md:rounded-sm p-5 h-full space-y-6 md:border-r">
          {/* Collections */}
          <div>
            <h3 className="label-mono text-paper/40 mb-3">
              Collections
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveCollection(null); setFileTypeFilter("all"); setStatusFilter("all"); setSortOption("custom"); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-all ${
                  activeCollection === null
                    ? "bg-gold/10 text-gold border border-gold/30"
                    : "text-paper/60 hover:text-paper hover:bg-surface-hover border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Queue
                </span>
                <span className="label-mono bg-surface-hover px-2 py-0.5 rounded-full">
                  {queueCount}
                </span>
              </button>

              <AnimatePresence>
                {collections.map((col) => (
                  <motion.button
                    key={col.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => { setActiveCollection(col.id); setFileTypeFilter("all"); setStatusFilter("all"); setSortOption("custom"); setSidebarOpen(false); }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleDeleteCollection(col.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-all ${
                      activeCollection === col.id
                        ? "bg-gold/10 text-gold border border-gold/30"
                        : "text-paper/60 hover:text-paper hover:bg-surface-hover border border-transparent"
                    }`}
                    title="Right-click to delete"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {col.name}
                    </span>
                    <span className="label-mono text-paper/40">{col.doc_ids.length}</span>
                  </motion.button>
                ))}
              </AnimatePresence>

              <button
                onClick={handleNewCollection}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-sm text-paper/40 hover:text-gold hover:bg-gold/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                New collection
              </button>
            </div>
          </div>

          {/* File Type */}
          <div>
            <h3 className="label-mono text-paper/40 mb-3">
              File type
            </h3>
            <div className="space-y-1">
              {([
                { key: "all", label: "All types", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )},
                { key: "pdf", label: "PDF", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )},
                { key: "docx", label: "Word", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )},
                { key: "epub", label: "EPUB", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )},
                { key: "url", label: "Web article", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                )},
                { key: "txt", label: "Text", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h8m-8 6h16" />
                  </svg>
                )},
              ] as { key: FileTypeFilter; label: string; icon: React.ReactNode }[]).map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setFileTypeFilter(item.key); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-all ${
                    fileTypeFilter === item.key
                      ? "bg-gold/10 text-gold border border-gold/30"
                      : "text-paper/60 hover:text-paper hover:bg-surface-hover border border-transparent"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="label-mono text-paper/40 mb-3">
              Status
            </h3>
            <div className="space-y-1">
              {([
                { key: "all", label: "All", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )},
                { key: "uploaded", label: "Not Started", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                  </svg>
                )},
                { key: "converting", label: "In Progress", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )},
                { key: "completed", label: "Done", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )},
                { key: "error", label: "Failed", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )},
              ] as { key: StatusFilter; label: string; icon: React.ReactNode }[]).map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setStatusFilter(item.key); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-all ${
                    statusFilter === item.key
                      ? "bg-gold/10 text-gold border border-gold/30"
                      : "text-paper/60 hover:text-paper hover:bg-surface-hover border border-transparent"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h3 className="label-mono text-paper/40 mb-3">
              Sort
            </h3>
            <div className="space-y-1">
              {([
                { key: "custom", label: "Custom", sublabel: "Default" },
                { key: "recently_played", label: "Recently played", sublabel: null },
                { key: "newest", label: "Newest added", sublabel: null },
                { key: "oldest", label: "Oldest added", sublabel: null },
              ] as { key: SortOption; label: string; sublabel: string | null }[]).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSortOption(item.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-all ${
                    sortOption === item.key
                      ? "bg-gold/10 text-gold border border-gold/30"
                      : "text-paper/60 hover:text-paper hover:bg-surface-hover border border-transparent"
                  }`}
                >
                  <span>
                    {item.label}
                    {item.sublabel && (
                      <span className="ml-1.5 text-xs opacity-50">({item.sublabel})</span>
                    )}
                  </span>
                  {sortOption === item.key && (
                    <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0">
        {/* Save-your-key banner (shows once, until the user confirms saved) */}
        <SaveKeyBanner />

        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display text-paper">
              {activeCollectionObj ? activeCollectionObj.name : "Queue"}
            </h1>
            <p className="label-mono text-paper/40 mt-1">
              {filteredDocs.length} {filteredDocs.length === 1 ? "document" : "documents"}
              {(fileTypeFilter !== "all" || statusFilter !== "all") && filteredDocs.length === 0 && (
                <span className="ml-2 text-gold-soft">(filters active)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Edit button (for collection management) */}
            {activeCollectionObj && (
              <button
                onClick={() => handleDeleteCollection(activeCollectionObj.id)}
                className="label-mono px-3 py-1.5 rounded-sm text-paper/60 hover:text-paper border border-hairline hover:border-hairline-strong transition-all"
              >
                Edit
              </button>
            )}

            {/* Edit/Done button for Queue reordering */}
            {!activeCollectionObj && documents.length > 0 && (
              <button
                onClick={() => {
                  if (!editMode) {
                    // Entering edit mode: ensure we have an order stored
                    if (documentOrder.length === 0) {
                      const currentOrder = filteredDocs.map((d) => d.id);
                      saveDocumentOrder(currentOrder);
                    }
                    setSortOption("custom");
                  }
                  setEditMode(!editMode);
                }}
                className={`label-mono px-3 py-1.5 rounded-sm transition-all ${
                  editMode
                    ? "bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20"
                    : "text-paper/60 hover:text-paper border border-hairline hover:border-hairline-strong"
                }`}
              >
                {editMode ? "Done" : "Edit"}
              </button>
            )}

            {/* View mode toggle */}
            <div className="flex items-center border border-hairline rounded-sm overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-all ${
                  viewMode === "grid"
                    ? "bg-gold/10 text-gold"
                    : "text-paper/40 hover:text-paper hover:bg-surface-hover"
                }`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-all ${
                  viewMode === "list"
                    ? "bg-gold/10 text-gold"
                    : "text-paper/40 hover:text-paper hover:bg-surface-hover"
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-44 pl-9 pr-3 py-2 bg-surface border border-hairline rounded-sm text-paper text-sm placeholder-paper/40 focus:border-gold/30 focus:ring-1 focus:ring-gold/20 focus:outline-none transition-all"
              />
            </div>

            {/* Export whole library */}
            {documents.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Download all your audiobooks + metadata as one file you can keep and re-import"
                className="label-mono px-4 py-2 rounded-sm border border-hairline text-paper/70 hover:border-gold/40 hover:text-gold transition-all disabled:opacity-50"
              >
                {exporting ? "Exporting…" : "⬇ Export"}
              </button>
            )}

            {/* Add new */}
            <Link
              href="/convert"
              className="label-mono px-4 py-2 rounded-sm bg-gold text-ink hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              + Add
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        {documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
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
                className="bg-surface border border-hairline rounded-sm p-4 text-center hover-lift"
              >
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-lg font-display text-paper">
                  {stat.value > 0 ? <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={1.5} /> : "—"}
                </div>
                <div className="label-mono text-paper/40">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Collection assignment (when a collection is active) */}
        {activeCollectionObj && documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-3 bg-surface border border-hairline rounded-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-paper/60">
                Add documents to <span className="text-gold font-medium">{activeCollectionObj.name}</span>:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {documents.map((doc) => {
                const isInCollection = activeCollectionObj.doc_ids.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() =>
                      isInCollection
                        ? handleRemoveFromCollection(doc.id, activeCollectionObj.id)
                        : handleAddToCollection(doc.id, activeCollectionObj.id)
                    }
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition-all ${
                      isInCollection
                        ? "bg-gold/10 text-gold border border-gold/30"
                        : "text-paper/40 hover:text-paper/60 bg-surface border border-hairline hover:border-hairline-strong"
                    }`}
                  >
                    {isInCollection ? "✓ " : ""}{doc.title.length > 25 ? doc.title.slice(0, 25) + "..." : doc.title}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Content area */}
        {fetchError && documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 bg-surface border border-hairline rounded-sm"
          >
            <div className="text-6xl mb-6">📡</div>
            <h2 className="text-xl font-display text-paper mb-2">Couldn&apos;t reach the server</h2>
            <p className="text-paper/60 text-sm mb-8 max-w-sm mx-auto">
              Your library is safe — we just couldn&apos;t load it. Check your
              connection and try again.
            </p>
            <button
              onClick={() => {
                setLoading(true);
                fetchDocuments();
              }}
              className="label-mono inline-flex px-8 py-3 rounded-full bg-gold text-ink hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              Retry
            </button>
          </motion.div>
        ) : documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center py-24 bg-surface border border-hairline rounded-sm"
          >
            <div className="text-6xl mb-6">📚</div>
            <h2 className="text-xl font-display text-paper mb-2">Get started</h2>
            <p className="text-paper/60 text-sm mb-8 max-w-sm mx-auto">
              Add your documents, books, or web articles to Book2Audio and start listening to them.
            </p>
            <Link
              href="/convert"
              className="label-mono inline-flex px-8 py-3 rounded-full bg-gold text-ink hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              Add your first document
            </Link>
          </motion.div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-hairline rounded-sm">
            <p className="text-paper/60">No documents match your current filters</p>
            <button
              onClick={() => {
                setFileTypeFilter("all");
                setStatusFilter("all");
                setSearch("");
                setActiveCollection(null);
              }}
              className="mt-4 text-sm text-gold hover:text-gold-soft transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : editMode ? (
          <div className="flex flex-col gap-2">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                draggable
                onDragStart={(e) => handleDragStart(e, doc.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, doc.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 bg-surface rounded-sm border transition-all cursor-grab active:cursor-grabbing ${
                  draggedId === doc.id
                    ? "border-gold/30 opacity-50 scale-[0.98]"
                    : "border-hairline hover:border-hairline-strong"
                }`}
              >
                {/* Drag handle */}
                <span className="text-paper/40 select-none text-lg leading-none flex-shrink-0" title="Drag to reorder">
                  &#x2261;
                </span>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-paper truncate">{doc.title}</p>
                  <p className="label-mono text-paper/40 mt-0.5">
                    {doc.format?.toUpperCase()}{doc.audio_duration ? ` · ${formatDuration(doc.audio_duration)}` : ""}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-paper/40 hover:text-burgundy-soft hover:bg-burgundy/15 transition-all"
                  title="Delete document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-surface border border-hairline rounded-sm divide-y divide-hairline overflow-hidden">
            <AnimatePresence>
              {filteredDocs.map((doc, i) => {
                const isReady = doc.status === "completed";
                const href = isReady ? `/player/${doc.id}` : `/convert?doc=${doc.id}`;
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="group flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-surface-hover transition-colors"
                  >
                    {/* Index */}
                    <span className="label-mono text-gold shrink-0 w-12 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Title + format */}
                    <Link href={href} className="flex-1 min-w-0">
                      <h3 className="font-display text-paper text-lg leading-snug truncate group-hover:text-gold-faint transition-colors">
                        {doc.title}
                      </h3>
                      <span className="label-mono text-paper/40">
                        {doc.format?.toUpperCase()}
                        {isReady
                          ? ""
                          : doc.status === "converting"
                          ? " · Converting"
                          : doc.status === "queued"
                          ? " · Queued"
                          : doc.status === "uploaded"
                          ? " · Not started"
                          : " · Failed"}
                      </span>
                    </Link>

                    {/* Metadata */}
                    <div className="hidden sm:flex items-center gap-6 shrink-0 label-mono text-paper/40">
                      <span>{doc.total_word_count.toLocaleString()} words</span>
                      {doc.audio_duration && <span className="text-gold-soft">{formatDuration(doc.audio_duration)}</span>}
                    </div>

                    {/* Play / convert affordance */}
                    <Link
                      href={href}
                      className={`label-mono shrink-0 px-3 py-1.5 rounded-full transition-all ${
                        doc.status === "error"
                          ? "bg-burgundy/10 text-burgundy-soft border border-burgundy/30 hover:bg-burgundy/20"
                          : "bg-gold/10 text-gold border border-gold/30 hover:bg-gold hover:text-ink"
                      }`}
                    >
                      {isReady
                        ? "Play"
                        : doc.status === "uploaded"
                        ? "Convert"
                        : doc.status === "queued"
                        ? "Queued ›"
                        : doc.status === "converting"
                        ? "Converting ›"
                        : "Retry"}
                    </Link>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-paper/40 hover:text-burgundy-soft hover:bg-burgundy/15 transition-all"
                      title="Delete document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
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
      </main>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-ink-soft rounded-sm border border-hairline-strong shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] p-6 w-80 max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-display text-paper mb-2">
                {confirmDelete.type === "collection" ? "Delete collection?" : "Delete document?"}
              </h3>
              <p className="text-sm text-paper/60 mb-6">
                {confirmDelete.type === "collection"
                  ? "This collection will be removed. Documents inside it will not be deleted."
                  : "This document and its audio will be permanently deleted."}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="label-mono px-4 py-2 rounded-sm text-paper/60 hover:text-paper hover:bg-surface-hover transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmDelete.type === "collection") {
                      executeDeleteCollection(confirmDelete.id);
                    } else {
                      executeDeleteDocument(confirmDelete.id);
                    }
                    setConfirmDelete(null);
                  }}
                  className="label-mono px-4 py-2 rounded-sm bg-burgundy hover:bg-burgundy-soft text-paper transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

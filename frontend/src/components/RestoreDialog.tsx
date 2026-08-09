"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/SessionContext";

/**
 * Paste-your-restore-key dialog. On success, re-attaches this device to the
 * saved library and sends the user to it.
 */
export default function RestoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { restore } = useSession();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await restore(key);
      onClose();
      router.push("/library");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "That key didn't work. Check it and try again.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-sm border border-hairline bg-surface p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="label-mono text-gold">Come back to your library</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-paper">Restore a session</h2>
        <p className="mt-2 font-serif text-sm text-paper/60">
          Paste the restore key you saved. It brings back your books, chapters, and
          where you left off — no account needed.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            autoFocus
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="PAGE-XXXX-XXXX-XXXX"
            className="w-full rounded-sm border border-hairline bg-ink px-4 py-3 text-center font-mono uppercase tracking-widest text-paper placeholder-paper/30 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/20"
          />
          {error && <p className="font-serif text-sm text-burgundy-soft">{error}</p>}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="w-full rounded-sm bg-gold py-3 font-display text-lg text-ink transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "Restoring…" : "Restore my library"}
          </button>
        </form>
        <button
          onClick={onClose}
          className="mt-4 w-full text-center font-serif text-sm text-paper/40 hover:text-paper"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

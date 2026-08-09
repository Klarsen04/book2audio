"use client";

import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";

/**
 * Persistent "save your restore key" banner. Because free-tier data can be wiped
 * on redeploy, the key is the only way back — so we keep this visible until the
 * user confirms they've saved it.
 */
export default function SaveKeyBanner() {
  const { restoreKey, keySaved, markKeySaved } = useSession();
  const [copied, setCopied] = useState(false);

  if (!restoreKey || keySaved) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(restoreKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="mb-8 rounded-sm border border-gold/30 bg-gold/[0.06] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="label-mono text-gold">✨ Save your restore key</p>
          <p className="mt-1 font-serif text-sm text-paper/70">
            No account needed — this key is how you return to your library later.
            Save it somewhere safe.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <code className="rounded-sm border border-hairline bg-ink px-4 py-2 font-mono tracking-widest text-paper">
            {restoreKey}
          </code>
          <button
            onClick={copy}
            className="label-mono rounded-sm bg-gold px-4 py-2.5 text-ink transition-transform hover:scale-[1.02] active:scale-95"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={markKeySaved}
            className="label-mono px-2 py-2.5 text-paper/50 hover:text-paper"
            title="Dismiss — I've saved it"
          >
            Saved it
          </button>
        </div>
      </div>
    </div>
  );
}

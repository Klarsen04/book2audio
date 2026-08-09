"use client";

import { useEffect, useState } from "react";

/**
 * A slim, dismissable "Add to Home Screen" hint for iOS Safari — the one place
 * that has no install button/prompt API. Shows once (respects a dismissed flag
 * in localStorage), only on iOS, and only when not already running standalone.
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("b2a_a2hs_dismissed") === "true") return;
    } catch {}

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    // iPadOS 13+ reports as Mac; detect touch to catch it.
    const isIPadOS =
      /Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if ((isIOS || isIPadOS) && isSafari && !standalone) {
      const t = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem("b2a_a2hs_dismissed", "true");
    } catch {}
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-md rounded-sm border border-hairline-strong bg-surface/95 p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg text-gold" aria-hidden>
          ⎋
        </span>
        <div className="flex-1">
          <p className="font-display text-paper">Add Book2Audio to your Home Screen</p>
          <p className="mt-1 font-serif text-sm text-paper/60">
            Tap the <span className="text-paper">Share</span> icon below, then{" "}
            <span className="text-paper">Add to Home Screen</span> — it opens full-screen like an app.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="label-mono shrink-0 rounded-sm px-2 py-1 text-paper/40 hover:text-paper"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

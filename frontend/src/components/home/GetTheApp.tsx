"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Get the app" — Book2Audio installs as a PWA (no app store). We render a QR of
 * the current site origin (scan on a phone → open → Add to Home Screen), an
 * Android install button wired to beforeinstallprompt, and iOS A2HS steps.
 * The QR library is imported dynamically so it stays off the initial bundle.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function GetTheApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [origin, setOrigin] = useState("");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);

    // Draw the QR of the current origin.
    let cancelled = false;
    import("qrcode").then((QR) => {
      if (cancelled || !canvasRef.current) return;
      QR.toCanvas(canvasRef.current, window.location.origin, {
        width: 200,
        margin: 1,
        color: { dark: "#1a1815", light: "#f4f1ea" },
        errorCorrectionLevel: "M",
      }).catch(() => {});
    });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <section className="border-t border-hairline py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Copy + install actions */}
          <div>
            <p className="label-mono text-gold">Take it with you</p>
            <h2 className="mt-3 max-w-md font-display text-4xl font-bold leading-tight text-paper sm:text-5xl">
              Add Book2Audio to your phone.
            </h2>
            <p className="mt-4 max-w-md font-serif text-lg text-paper/60">
              It installs straight from the web — no App Store, no download. Scan
              the code, open it, and tap <span className="text-paper">Add to Home Screen</span>. It
              opens full-screen like a native app.
            </p>

            {installed ? (
              <p className="mt-8 label-mono text-gold">✓ Installed — open it from your home screen</p>
            ) : (
              <div className="mt-8 space-y-4">
                {installEvent && (
                  <button
                    onClick={install}
                    className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 font-display text-lg text-ink transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    Install app
                  </button>
                )}

                {/* Platform steps */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-sm border border-hairline bg-surface p-4">
                    <p className="label-mono text-paper/50">iPhone / iPad</p>
                    <p className="mt-2 font-serif text-sm leading-relaxed text-paper/70">
                      Open in <span className="text-paper">Safari</span> → tap the Share icon
                      <span className="text-gold"> ⎋</span> → <span className="text-paper">Add to Home Screen</span>.
                    </p>
                  </div>
                  <div className="rounded-sm border border-hairline bg-surface p-4">
                    <p className="label-mono text-paper/50">Android</p>
                    <p className="mt-2 font-serif text-sm leading-relaxed text-paper/70">
                      Open in <span className="text-paper">Chrome</span> → menu
                      <span className="text-gold"> ⋮</span> → <span className="text-paper">Install app</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* QR card */}
          <div className="flex justify-center lg:justify-end">
            <div className="paper-panel paper-grain rounded-sm p-8 text-center">
              <div className="mx-auto flex h-[216px] w-[216px] items-center justify-center rounded-sm bg-paper-bright p-2">
                <canvas ref={canvasRef} aria-label="QR code to open Book2Audio" />
              </div>
              <p className="label-mono mt-5 text-ink/60">Scan to open</p>
              {origin && (
                <p className="mt-1 max-w-[216px] truncate font-mono text-xs text-ink/40">
                  {origin.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

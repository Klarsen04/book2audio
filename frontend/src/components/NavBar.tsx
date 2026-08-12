"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/contexts/SessionContext";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/convert", label: "Convert" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const { active, restoreKey, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleSignOut = () => {
    // Confirm first — signing out drops this device's only link to the library.
    setMobileOpen(false);
    setConfirmSignOut(true);
  };

  const doSignOut = async () => {
    setConfirmSignOut(false);
    await signOut();
    // Return to the animated marketing homepage.
    router.push("/");
  };

  const copyKey = async () => {
    if (!restoreKey) return;
    try {
      await navigator.clipboard.writeText(restoreKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#16130f]/85 border-b border-hairline">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/library" className="font-display text-lg font-bold text-paper">
            Book<span className="text-gold">2</span>Audio
          </Link>
          <div className="hidden sm:flex gap-1 relative">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 rounded-sm label-mono transition-colors duration-200 ${
                  isActive(link.href)
                    ? "text-gold"
                    : "text-paper/50 hover:text-paper"
                }`}
              >
                {isActive(link.href) && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-sm bg-gold/10 border border-gold/25"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {active && (
            <>
              {restoreKey && (
                <button
                  onClick={copyKey}
                  title="Copy your restore key — save it to come back to this library"
                  className="hidden sm:flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 label-mono text-paper/60 hover:border-gold/40 hover:text-gold transition-colors"
                >
                  <span className="text-gold">⧉</span>
                  {copied ? "Copied" : restoreKey}
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="hidden sm:block font-serif text-sm text-paper/50 hover:text-paper transition-colors px-3 py-1.5 rounded-sm hover:bg-surface"
              >
                Sign out
              </button>
            </>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden p-2 rounded-sm text-paper/60 hover:text-paper hover:bg-surface transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden border-t border-hairline overflow-hidden"
          >
            <div className="px-6 py-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-sm label-mono transition-all ${
                    isActive(link.href)
                      ? "bg-gold/10 text-gold"
                      : "text-paper/50 hover:text-paper hover:bg-surface"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {active && restoreKey && (
                <button
                  onClick={() => { copyKey(); }}
                  className="w-full text-left px-4 py-2.5 rounded-sm label-mono text-gold hover:bg-surface transition-all"
                >
                  {copied ? "Key copied" : `⧉ ${restoreKey}`}
                </button>
              )}
              {active && (
                <button
                  onClick={() => { handleSignOut(); setMobileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 rounded-sm label-mono text-paper/50 hover:text-paper hover:bg-surface transition-all"
                >
                  Sign out
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign-out confirmation — the restore key is the only way back. */}
      <AnimatePresence>
        {confirmSignOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
            onClick={() => setConfirmSignOut(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-sm border border-hairline-strong bg-surface-hover p-6"
            >
              <h2 className="font-display text-xl text-paper mb-2">Sign out?</h2>
              <p className="font-serif text-sm leading-relaxed text-paper/70">
                Signing out removes this device&rsquo;s link to your library. You can
                only get back with your restore key — there&rsquo;s no account to
                recover it. Make sure you&rsquo;ve saved it.
              </p>
              {restoreKey && (
                <div className="mt-4 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-sm border border-hairline bg-ink px-3 py-2 font-mono text-sm tracking-widest text-paper">
                    {restoreKey}
                  </code>
                  <button
                    onClick={copyKey}
                    className="label-mono shrink-0 rounded-sm bg-gold px-3 py-2 text-ink"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="label-mono px-4 py-2 text-paper/60 hover:text-paper"
                >
                  Cancel
                </button>
                <button
                  onClick={doSignOut}
                  className="label-mono rounded-sm border border-burgundy/40 bg-burgundy/10 px-4 py-2 text-burgundy-soft transition-colors hover:bg-burgundy/20"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

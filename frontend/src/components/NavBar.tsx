"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/convert", label: "Convert" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    // Return to the animated marketing homepage, not the login screen.
    router.push("/");
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
          {user && (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center label-mono text-gold">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
                <span className="font-serif text-sm text-paper/60">
                  {user.name || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
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
              {user && (
                <button
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 rounded-sm label-mono text-paper/50 hover:text-paper hover:bg-surface transition-all"
                >
                  Sign out
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

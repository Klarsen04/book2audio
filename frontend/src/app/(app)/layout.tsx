"use client";

import NavBar from "@/components/NavBar";
import ToastProvider from "@/components/Toast";
import NowPlayingBar from "@/components/NowPlaying";
import ConfettiProvider from "@/components/Confetti";
import FloatingUpload from "@/components/FloatingUpload";
import CommandPalette from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="label-mono text-ink-faint">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#16130f]">
      <NavBar />
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8 pb-24">{children}</main>
      <FloatingUpload />
      <NowPlayingBar />
      <CommandPalette />
      <ToastProvider />
      <ConfettiProvider />
    </div>
  );
}

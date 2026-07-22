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
          <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[100px]" />
      </div>

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

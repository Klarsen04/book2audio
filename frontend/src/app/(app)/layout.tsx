"use client";

import NavBar from "@/components/NavBar";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/library"
            className="text-lg font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
          >
            Book2Audio
          </Link>
          <div className="flex gap-4">
            <Link href="/library" className="text-sm text-gray-400 hover:text-white transition-colors">
              Library
            </Link>
            <Link href="/convert" className="text-sm text-gray-400 hover:text-white transition-colors">
              Convert
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-gray-400">{user.name || user.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

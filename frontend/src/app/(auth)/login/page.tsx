"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/library");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <Link href="/" className="inline-block">
          <h1 className="font-display text-3xl font-bold text-paper">Book<span className="text-gold">2</span>Audio</h1>
        </Link>
        <p className="mt-3 font-serif text-paper/60">Welcome back. Sign in to continue.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-sm border border-hairline bg-surface p-8">
        <div>
          <label className="label-mono mb-2 block text-paper/50">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-sm border border-hairline bg-ink px-4 py-3 font-serif text-paper placeholder-paper/30 transition-all focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label-mono mb-2 block text-paper/50">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-sm border border-hairline bg-ink px-4 py-3 font-serif text-paper placeholder-paper/30 transition-all focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-sm border border-burgundy/40 bg-burgundy/15 p-3 font-serif text-sm text-burgundy-soft"
          >
            {error}
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-gold py-3 font-display text-lg text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-hairline"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="label-mono bg-[#16130f] px-3 text-paper/40">or</span>
        </div>
      </div>

      <a
        href="/api/auth/google"
        className="flex w-full items-center justify-center gap-3 rounded-sm border border-hairline bg-surface py-3 transition-all hover:bg-surface-hover hover:scale-[1.01] active:scale-[0.99]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span className="font-serif text-paper/70">Continue with Google</span>
      </a>

      <p className="text-center font-serif text-paper/50">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-gold underline-offset-4 transition-colors hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

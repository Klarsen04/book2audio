"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      // Cross-domain OAuth: tokens passed as URL params, exchange them via API
      api.post("/api/auth/set-cookies", { access_token: accessToken, refresh_token: refreshToken })
        .then(() => router.replace("/library"))
        .catch(() => router.replace("/login"));
    } else {
      // Same-domain (EC2): cookies already set by backend redirect
      router.replace("/library");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Signing you in...</p>
    </div>
  );
}

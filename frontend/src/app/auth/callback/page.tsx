"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      api
        .post("/api/auth/set-cookies", {
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(() => router.replace("/library"))
        .catch(() => router.replace("/login"));
    } else {
      router.replace("/library");
    }
  }, [router, searchParams]);

  return <p className="text-gray-400">Signing you in...</p>;
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p className="text-gray-400">Loading...</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}

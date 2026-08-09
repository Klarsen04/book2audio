"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/lib/api";

/**
 * No-login session model. Identity is a "restore key" the backend mints on the
 * first action that needs saving. We surface:
 *  - `active` / `documentCount`: does this device already have a library?
 *  - `restoreKey`: shown once (captured from the X-Restore-Key response header)
 *    so the user can save it and come back later.
 *  - restore(key) / signOut(): re-attach or detach this device.
 */
interface SessionContextType {
  loading: boolean;
  active: boolean;
  documentCount: number;
  restoreKey: string | null;
  keySaved: boolean;
  markKeySaved: () => void;
  refresh: () => Promise<void>;
  restore: (key: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

const KEY_STORAGE = "b2a_restore_key";
const KEY_SAVED_STORAGE = "b2a_restore_key_saved";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [restoreKey, setRestoreKey] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);

  // Capture the one-time restore key from any response that mints a session.
  useEffect(() => {
    const id = api.interceptors.response.use((response) => {
      const key = response.headers?.["x-restore-key"];
      if (key) {
        setRestoreKey(key);
        setActive(true);
        try {
          localStorage.setItem(KEY_STORAGE, key);
          localStorage.setItem(KEY_SAVED_STORAGE, "false");
        } catch {}
        setKeySaved(false);
      }
      return response;
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/api/session");
      setActive(!!res.data.active);
      setDocumentCount(res.data.document_count || 0);
    } catch {
      setActive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Restore any locally-remembered key state (the key itself is only shown once).
    try {
      const savedKey = localStorage.getItem(KEY_STORAGE);
      if (savedKey) setRestoreKey(savedKey);
      setKeySaved(localStorage.getItem(KEY_SAVED_STORAGE) === "true");
    } catch {}
    refresh();
  }, [refresh]);

  const markKeySaved = useCallback(() => {
    setKeySaved(true);
    try {
      localStorage.setItem(KEY_SAVED_STORAGE, "true");
    } catch {}
  }, []);

  const restore = useCallback(async (key: string) => {
    await api.post("/api/session/restore", { key });
    try {
      localStorage.setItem(KEY_STORAGE, key.trim().toUpperCase());
      localStorage.setItem(KEY_SAVED_STORAGE, "true");
    } catch {}
    setRestoreKey(key.trim().toUpperCase());
    setKeySaved(true);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.post("/api/session/signout");
    try {
      localStorage.removeItem(KEY_STORAGE);
      localStorage.removeItem(KEY_SAVED_STORAGE);
    } catch {}
    setRestoreKey(null);
    setKeySaved(false);
    setActive(false);
    setDocumentCount(0);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        loading,
        active,
        documentCount,
        restoreKey,
        keySaved,
        markKeySaved,
        refresh,
        restore,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

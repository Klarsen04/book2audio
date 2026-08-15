import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/**
 * No-login sessions for mobile. There are no accounts. On the first upload the
 * backend mints a guest session and returns:
 *   - X-Session-Token: the machine credential we store + send as a Bearer
 *     (React Native has no browser cookie jar, so we can't rely on cookies).
 *   - X-Restore-Key:  the human-facing key the user saves to return later.
 * Pasting the key on another device re-issues a token via /api/session/restore.
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://book2audio-eyw2.onrender.com';

if (!process.env.EXPO_PUBLIC_API_URL) {
  console.warn(
    `[book2audio] EXPO_PUBLIC_API_URL is not set — falling back to the production backend at ${API_BASE_URL}. ` +
      'Set EXPO_PUBLIC_API_URL to point at a local backend.'
  );
} else {
  console.log(`[book2audio] API base URL: ${API_BASE_URL}`);
}

const TOKEN_KEY = 'sessionToken';
const RESTORE_KEY = 'restoreKey';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Attach the stored session token as a Bearer on every request.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Capture a freshly-minted session (token + restore key) from response headers.
// The backend mints the session even when the request itself fails (e.g. a 413
// on the very first upload), so capture from error responses too.
const captureSessionHeaders = async (headers: any) => {
  const token = headers?.['x-session-token'];
  const key = headers?.['x-restore-key'];
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (key) await SecureStore.setItemAsync(RESTORE_KEY, key);
};

api.interceptors.response.use(
  async (response) => {
    await captureSessionHeaders(response.headers);
    return response;
  },
  async (error) => {
    await captureSessionHeaders(error?.response?.headers);
    return Promise.reject(error);
  }
);

export const getSessionToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const getRestoreKey = () => SecureStore.getItemAsync(RESTORE_KEY);

export const restoreSession = async (key: string) => {
  // Backend normalizes case + strips spaces; store the same canonical form.
  const normalized = key.replace(/\s+/g, '').toUpperCase();
  const res = await api.post('/api/session/restore', { key: normalized });
  const token = res.data?.session_token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(RESTORE_KEY, normalized);
  return res.data;
};

export const signOutSession = async () => {
  // Best-effort server-side signout before dropping the local credentials.
  try {
    await api.post('/api/session/signout', undefined, { timeout: 5000 });
  } catch {
    // Signout is stateless server-side; clearing local storage is what matters.
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(RESTORE_KEY);
};

/** Whether this device currently has a session + how many docs it owns. */
export const fetchSession = async () => {
  const res = await api.get('/api/session');
  return res.data as { active: boolean; document_count?: number };
};

export const audioUrl = (docId: string) => `${API_BASE_URL}/api/download/${docId}`;

export { API_BASE_URL };
export default api;

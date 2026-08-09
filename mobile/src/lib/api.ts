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
api.interceptors.response.use(async (response) => {
  const token = response.headers?.['x-session-token'];
  const key = response.headers?.['x-restore-key'];
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (key) await SecureStore.setItemAsync(RESTORE_KEY, key);
  return response;
});

export const getSessionToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const getRestoreKey = () => SecureStore.getItemAsync(RESTORE_KEY);

export const restoreSession = async (key: string) => {
  const res = await api.post('/api/session/restore', { key: key.trim() });
  const token = res.data?.session_token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(RESTORE_KEY, key.trim().toUpperCase());
  return res.data;
};

export const signOutSession = async () => {
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

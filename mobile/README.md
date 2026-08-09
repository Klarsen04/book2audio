# Book2Audio — Mobile (Expo / React Native)

Native iOS + Android app for Book2Audio. Same backend as the web app, same
no-login "restore key" sessions. No accounts: convert a document, save the
restore key you're shown, and paste it later (Settings → Restore) to get your
library back on any device.

## Run it

```bash
cd mobile
npm install
npx expo start          # then press i (iOS sim), a (Android), or scan the QR in Expo Go
```

### Point the app at a backend

By default it talks to the deployed backend. To use a local backend, set the
public env var before starting:

```bash
# iOS simulator can reach your Mac via localhost:
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start

# Physical phone (Expo Go): use your Mac's LAN IP, not localhost:
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000 npx expo start
```

Run the backend separately (from `../backend`):

```bash
TTS_PROVIDER=edge FORCE_EDGE_TTS=true python3.11 -m uvicorn app.main:app --port 8000
```

## How sessions work on mobile

React Native has no browser cookie jar, so instead of the HTTP-only session
cookie the app uses the **session token** the backend returns in the
`X-Session-Token` response header (stored in `expo-secure-store`, sent as
`Authorization: Bearer …`). The human-facing **restore key** (`X-Restore-Key`)
is shown after the first conversion and on the Settings screen. Pasting a key
calls `/api/session/restore`, which returns a fresh token.

## Screens

- **Library** — your documents (editorial list; tap to open the player).
- **Convert** — pick a file → choose audio type + optional "spoken summary"
  intro + voice → convert (progress) → shows your restore key.
- **Player** — streams `/api/download/{id}` with the Bearer token; chapter list,
  ±30s, speed, seek-to-chapter.
- **Settings** — copy restore key, restore another library, sign out, version.

## Notes

- Node 20.19.4+ is recommended (Expo 57 / RN 0.86 warns on 20.19.0 but runs).
- Design matches the web editorial system (warm ink + paper + gold), defined in
  `src/lib/theme.ts`.

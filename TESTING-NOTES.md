# Testing Notes - Full Site Audit (2026-07-28)

## Bugs (Must Fix)

### 1. `/api/upload-url` endpoint missing (404)
- **Page**: Convert > Paste URL tab
- **Issue**: Frontend calls `POST /api/upload-url` but no backend endpoint exists
- **Fix**: Add backend endpoint that fetches URL content, extracts text, creates document

### 2. `/api/upload-text` endpoint missing (404)
- **Page**: Convert > Paste Text tab
- **Issue**: Frontend calls `POST /api/upload-text` but no backend endpoint exists
- **Fix**: Add backend endpoint that accepts raw text, creates document entry

### 3. Playback Speed dropdown renders off-screen
- **Page**: Player
- **Issue**: Speed control popup (0.5x, 1.25x, 2x, 3x, 4x) renders at top-right edge, partially clipped by viewport. Doesn't close properly.
- **Fix**: Position dropdown below/left of the button with proper bounds checking

### 4. Sleep Timer popup overlaps navigation bar
- **Page**: Player
- **Issue**: Sleep timer "Stop playing after" popup appears but overlaps the fixed nav bar at top. Z-index conflict.
- **Fix**: Ensure sleep timer popup has proper z-index below the navbar, or positions below the trigger

### 5. Sleep Timer popup doesn't close on outside click
- **Page**: Player
- **Issue**: Sleep timer popup persists across multiple interactions (visible in screenshots 14, 15, 17, 20, 21). Once opened it never closes until page refresh.
- **Fix**: Add outside-click handler to dismiss the popup

### 6. Reader settings panel doesn't close properly
- **Page**: Player > Reader view
- **Issue**: Clicking the (⋮) settings button opens the settings panel, but clicking the chapter 2 item (which is behind it) times out because `<div class="max-w-4xl mx-auto space-y-6">` intercepts pointer events
- **Fix**: Settings panel should close on outside click and have proper z-index isolation

### 7. Bookmarks dropdown doesn't close on outside click
- **Page**: Player
- **Issue**: Bookmarks list stays open across interactions (visible in screenshots 20, 21)
- **Fix**: Add outside-click handler

### 8. Landing page is mostly empty below the fold
- **Page**: Landing (/)
- **Issue**: After the hero section with CTA, the page is almost entirely blank black space with only a tiny footer at the bottom. Audio sample players (7 detected) are invisible/not rendering.
- **Fix**: Audio demo section, features section, testimonials, or document type showcase needed. The voice sample `<audio>` elements exist in DOM but have no visible UI.

### 9. Mobile landing page - content below hero is blank
- **Page**: Landing (mobile viewport)
- **Issue**: Same as #8 but more severe on mobile - massive empty space below fold
- **Fix**: Ensure demo content renders on mobile

### 10. Search only searches current chapter (no cross-chapter search)
- **Page**: Player > Reader
- **Issue**: Search "findme" shows "No matches" when viewing Chapter 1 but the term is in Chapter 2. User has no way to know which chapter contains their search term.
- **Fix**: Either search all chapters and show which ones have matches, or auto-navigate to first chapter with a match

## UX Issues (Should Fix)

### 11. No mobile hamburger menu
- **Page**: All pages on mobile
- **Issue**: Nav bar has Library/Convert/Settings links that likely overflow on narrow screens. No hamburger/drawer for mobile navigation.
- **Fix**: Add responsive nav with hamburger menu below ~768px

### 12. Highlights button missing from player
- **Page**: Player
- **Issue**: Test found no Highlights button. The component (`Highlights.tsx`) is imported but may not be rendering.
- **Fix**: Check HighlightsPanel rendering condition

### 13. Bookmark button text runs together
- **Page**: Player
- **Issue**: Button text reads "Bookmark 0:02at current position" — missing space/line break between timestamp and subtitle
- **Fix**: Add proper spacing between the two text elements

### 14. Multiple popups can be open simultaneously
- **Page**: Player
- **Issue**: Sleep timer, bookmarks list, speed dropdown, and reader settings can all be open at the same time, overlapping each other
- **Fix**: Close other popups when a new one opens (use a shared "active popup" state or click-away pattern)

### 15. Flashcards view - unclear functionality
- **Page**: Player > Flashcards tab
- **Issue**: Not tested (test crashed before reaching), but the feature's utility is unclear since flashcards would need to be created from document content
- **Fix**: Needs investigation

### 16. Document title shows "Untitled" for .txt files
- **Page**: Convert, Player, Library
- **Issue**: Text files always get title "Untitled" since `extract_from_txt()` returns `title="Untitled"`
- **Fix**: Use filename (without extension) as title when no title is detected

## Working Features (Verified)

| Feature | Status |
|---------|--------|
| Registration (email/password) | ✅ Works |
| Login + cookie auth | ✅ Works |
| File upload (.txt) | ✅ Works |
| Chapter detection from text | ✅ Works (3 chapters detected) |
| Voice selection (all 8 voices) | ✅ Works |
| Voice preview (all voices) | ✅ Works |
| Audio type selection (Full/Long/Short) | ✅ Works (UI only - backend ignores) |
| Additional Context toggle | ✅ Works (UI only) |
| TTS conversion (gTTS) | ✅ Works |
| Audio player (play/pause) | ✅ Works |
| Skip forward/back | ✅ Works |
| Progress bar / seek | ✅ Works |
| Download audio | ✅ Works |
| A-B Loop controls | ✅ Present |
| Volume control | ✅ Works |
| Playback speed | ✅ Works (dropdown positioning broken) |
| Sleep timer | ✅ Logic works (popup stuck open) |
| Keyboard shortcuts | ✅ Present |
| Study Timer (presets) | ✅ Works |
| Study Timer (pause/reset) | ✅ Works |
| Bookmarks (add) | ✅ Works |
| Bookmarks (timestamp shown) | ✅ Works |
| Bookmarks (list/navigate) | ✅ Works |
| Auto-play next toggle | ✅ Works |
| Share (copy link) | ✅ Present |
| Chapter mini-map | ✅ Works |
| Reader view (TOC sidebar) | ✅ Works |
| Reader view (chapter content) | ✅ Works |
| Reader settings (font/size/spacing/width) | ✅ Works |
| Chapter navigation (prev/next) | ✅ Works |
| "Play this chapter" button | ✅ Works |
| Search input | ✅ Present |
| Notes panel (type/save) | ✅ Works |
| Notes export (md/txt/clipboard) | ✅ Works |
| View tabs (Reader/Notes/Flashcards/Minimal) | ✅ Works |
| Library filters (type/status/sort) | ✅ Present |
| Library collections | ✅ Present |
| Library search | ✅ Present |
| Library empty state | ✅ Nice empty state |
| Settings page | ✅ Renders |
| Sign out | ✅ Present |
| Google OAuth button | ✅ Present (needs credentials) |

## Priority Order for Fixes

1. **#1, #2** - Missing endpoints (Paste URL, Paste Text) — features shown in UI don't work at all
2. **#5, #7** - Popups don't close (Sleep Timer, Bookmarks) — makes the app feel broken
3. **#3, #4** - Speed/Sleep popups position/z-index — overlaps nav, clips off-screen
4. **#8, #9** - Landing page empty — first impression for new users
5. **#10** - Cross-chapter search — search appears broken from user perspective
6. **#13** - Bookmark text spacing — quick CSS fix
7. **#6, #14** - Popup mutual exclusion and settings close
8. **#11** - Mobile nav — responsive fix
9. **#12, #16** - Highlights button, txt file title — minor polish

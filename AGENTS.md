# YouTube Playlist Player - Multi-Session Architectural Guide & Plan

## Project Vision & Overview

A local-first, highly customizable YouTube & YouTube Music playlist player. It allows users to import public/private YouTube playlists, store tracks locally with enhanced metadata (editable song title and artist), perform true random shuffle, filter tracks by title/artist without breaking playback context, and dynamically monitor link health (detecting deleted, private, or region-restricted videos in a cascaded background worker).

---

## 🛠️ Tech Stack & Philosophy

- **Framework**: Vite + Preact (`preact/signals` for lightweight state management)
- **Styling**: Tailwind CSS + Vanilla CSS micro-animations (sleek dark mode, glassmorphism UI)
- **Persistence Layer**: Modular Storage Adapter Pattern (IndexedDB / LocalStorage primary, designed with abstract `PlaylistRepository` interface to seamlessly swap with MongoDB / PostgreSQL / REST API in the future)
- **API & Video Engine**: YouTube Data API v3 (for playlist fetching & background validation) + YouTube IFrame Player API (for audio/video playback control)
- **External Dependencies**: Minimalized to core essentials (Vite, Preact, Tailwind CSS, `@preact/signals`).

---

## 📁 Architecture & File Structure

```
youtube-player/
├── AGENTS.md                  # Instructions and state for multi-session work
├── package.json
├── index.html
├── vite.config.js
├── tailwind.config.js
└── src/
    ├── main.jsx               # Preact app mounting point
    ├── index.css              # Custom CSS utilities, glassmorphism, scrollbars
    ├── types/                 # JSDoc / Type definitions for data models
    │   └── player.js
    ├── storage/               # Modular Repository Pattern
    │   ├── StorageAdapter.js  # Abstract Storage Interface
    │   ├── LocalStorageAdapter.js
    │   ├── IndexedDBAdapter.js
    │   └── index.js           # Storage factory / active adapter export
    ├── api/                   # External APIs & Link Checkers
    │   ├── youtubeApi.js      # YouTube Data API v3 integration
    │   ├── iframePlayer.js    # YouTube IFrame Player wrapper
    │   ├── metadataParser.js  # Heuristic parser for Artist - Song Title
    │   └── linkChecker.js     # Cascading link integrity validator
    ├── state/                 # Preact Signals State Management
    │   ├── playlistState.js   # Playlists & Track management
    │   ├── playerState.js     # Current track, queue, shuffle, repeat, playback state
    │   └── settingsState.js   # API Key, storage settings, background check options
    ├── components/            # UI Components
    │   ├── common/            # Buttons, Modals, Badges, Inputs
    │   ├── layout/            # Sidebar, Main Container, Header
    │   ├── player/            # Bottom Audio/Video Player Bar, Volume, Seekbar
    │   ├── playlist/          # Track Table, Metadata Editor Modal, Link Health Status
    │   ├── queue/             # Up Next Queue, Shuffled View
    │   └── settings/          # API Key setup & Database migration status
    └── utils/                 # Fisher-Yates shuffle, fuzzy filter helpers
        └── helpers.js
```

---

## 🧩 Data Models

### Track Model

```js
/**
 * @typedef {Object} Track
 * @property {string} id - Internal UUID or YouTube Video ID
 * @property {string} videoId - YouTube Video ID (e.g. "dQw4w9WgXcQ")
 * @property {string} originalTitle - Original title from YouTube
 * @property {string} title - Custom user-defined song title
 * @property {string} artist - Custom user-defined artist name
 * @property {string} channelTitle - Original uploader/channel name
 * @property {string} thumbnailUrl - Album art / video thumbnail URL
 * @property {number} durationSeconds - Track duration in seconds
 * @property {'healthy'|'warning'|'broken'|'unchecked'} status - Link health status
 * @property {string|null} statusMessage - Reason if warning/broken (e.g. "Private video", "Deleted")
 * @property {boolean} [removedFromSource] - True if the track is no longer present in the original YouTube playlist (sync-detected; track stays local with its metadata)
 * @property {number} addedAt - Timestamp when added
 * @property {number} lastCheckedAt - Timestamp of last integrity check
 */
```

### Playlist Model

```js
/**
 * @typedef {Object} Playlist
 * @property {string} id - Unique Playlist ID
 * @property {string|null} youtubePlaylistId - External YouTube Playlist ID (if synced)
 * @property {string} title - Playlist name
 * @property {string} description - Playlist description
 * @property {Array<Track>} tracks - Array of tracks in ordered sequence
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last edit timestamp
 */
```

---

## 🔑 Core Feature Specifications

### 1. Storage Abstraction Layer (Future DB Migration Ready)

- Define `StorageAdapter` base contract:
  - `getPlaylists(): Promise<Playlist[]>`
  - `savePlaylist(playlist: Playlist): Promise<void>`
  - `deletePlaylist(id: string): Promise<void>`
  - `updateTrack(playlistId: string, trackId: string, updates: Partial<Track>): Promise<void>`
  - `exportData(): Promise<string>`
  - `importData(jsonData: string): Promise<void>`
- Implementation switch via `storage/index.js` allowing seamless replacement with MongoDB/PostgreSQL backends without touching UI components.

### 2. Smart Metadata Parsing & Editing

- When adding tracks or syncing a playlist, `metadataParser.js` parses strings such as:
  - `"Artist Name - Song Title (Official Video)"` -> Artist: `"Artist Name"`, Title: `"Song Title"`
  - `"Song Title ft. Feature - Artist Name"` -> Artist: `"Artist Name"`, Title: `"Song Title ft. Feature"`
- Inline and Modal editing UI for title and artist with search suggestion / quick clean-up triggers.

### 3. Smart Custom Shuffle Engine

- Standard YouTube shuffle is biased or limited to loaded DOM chunks.
- Our Custom Engine implements **Fisher-Yates Shuffle with History Tracking**:
  - Maintains `originalIndices` and `unplayedQueue`.
  - Ensures no repeat tracks until full list cycle completes.
  - Keeps user's active song in view without resetting current progress.

### 4. Continuous Filtered Playback

- Live search input filters tracks by `title` OR `artist`.
- Playback queue dynamically adapts to filtered subset when playing while preserving active playing song state.
- **Problem filter chip** in the toolbar: shows counts (broken/avisos) and toggles a `problemFilter` that narrows the list (and queue) to tracks with `broken`/`warning` status; composes with the search query.
- **Large playlists (1000+ tracks)**: the table renders lazily (`visibleLimit` signal, 100 rows + "Mostrar más"); shuffle, filtering and playback always operate on the FULL track list, never on the rendered subset.

### 5. Cascading Link Integrity Checker

- Runs a single sweep **once per session** (startup + after imports), politely paced to respect API quotas: **one batch of 50 video IDs per request, 1 batch per minute** (5s interval in manual mode).
- Only re-checks tracks that are `unchecked`, in `warning`, or stale (> 7 days since `lastCheckedAt`), so each session's sweep is light and doesn't repeat work.
- Checks availability via YouTube API (`videos.list?part=status`) or IFrame Player error triggers (errors 2, 5, 100, 101, 150 - the latter auto-marks the current track).
- Flags unavailable tracks in UI with icon-only badges (tooltip on hover) and presents a quick "Find Replacement Link" option (search + swap videoId without losing custom metadata).

### 6. Playlist Sync with YouTube (startup refresh)

- Local playlists that have a `youtubePlaylistId` can be re-synced against YouTube (toggle `autoSyncPlaylists`, default ON). Manual actions (link check, sync, delete playlist) live in the Settings modal under "Mantenimiento de Playlists" (delete uses two-step confirm).
- On sync: **new tracks added to the YouTube playlist are appended at the end** (with parsed metadata, `status: 'unchecked'`), and tracks that were **removed from YouTube are flagged `removedFromSource: true` but stay local** with all custom metadata intact (nothing is lost).
- Sync never overwrites user-edited title/artist; it only updates playlist title/thumbnail/description.
- Re-adding songs to the *original* YouTube playlist requires OAuth (write API, out of scope with API key only) — the UI offers opening the video on YouTube to re-add manually.

---

## 🚀 Multi-Session Implementation Roadmap

### Phase 1: Project Setup & Storage Engine (Session 1)

- [ ] Initialize Vite + Preact project structure.
- [ ] Configure Tailwind CSS, Google Fonts (Inter/Outfit), and basic dark/glassmorphism design system.
- [ ] Build `StorageAdapter` interface, `IndexedDBAdapter` & `LocalStorageAdapter`.
- [ ] Create initial state store using `@preact/signals`.

### Phase 2: YouTube API & Player Integration (Session 2)

- [ ] Build `iframePlayer.js` wrapper around YouTube Iframe API.
- [ ] Create persistent bottom Audio/Video Player component (Play/Pause, Seekbar, Volume, Mute, Fullscreen embed toggle).
- [ ] Build API Key configuration UI & YouTube Data API fetcher for public/private playlists.

### Phase 3: Track Management & Metadata Editor (Session 3)

- [ ] Build Playlist view, track list grid/table with drag/sort or reorder support.
- [ ] Implement `metadataParser.js` (auto-extract artist & song title).
- [ ] Add track editor modal (rename title, edit artist, swap video link).

### Phase 4: Custom Shuffle & Filtered Playback (Session 4)

- [ ] Build smart Fisher-Yates shuffle engine with unplayed queue history.
- [ ] Implement real-time title/artist search filter.
- [ ] Connect search filtering directly to playback queue engine.

### Phase 5: Link Integrity Checker & Repair UI (Session 5)

- [ ] Implement cascading background link checker worker (`linkChecker.js`).
- [ ] Add visual badges (Healthy, Warning, Broken) in track lists.
- [ ] Create "Broken Link Repair Modal" to search YouTube and update video ID without losing custom metadata.

### Phase 6: Polish, Testing & Export/Import (Session 6)

- [ ] Add JSON backup export & import for offline database safety.
- [ ] Add micro-animations, keyboard shortcuts (Space bar play/pause, arrows seek/volume, 'M' mute).
- [ ] Perform full end-to-end testing and code verification.

---

agy --conversation=e77f45cc-b3a8-4704-8956-c544e978c2e8

---

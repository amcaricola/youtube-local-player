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
    │   ├── iframePlayer.js    # Player init + commands (play, seek, volume, fullscreen)
    │   ├── playerEvents.js    # Handlers de eventos del reproductor (ready/state/error)
    │   ├── metadataParser.js  # Heuristic parser for Artist - Song Title
    │   ├── linkChecker.js     # Cascading link integrity validator (barrido + estado)
    │   └── linkStatus.js      # Helpers puros: recovery window, needsCheck, buildTrackUpdates
    ├── state/                 # Preact Signals State Management
    │   ├── playlistState.js   # Núcleo: signals, filteredTracks, problemCounts, sort, toast
    │   ├── playlistImports.js # Carga local, importación y sync con YouTube
    │   ├── playlistCrud.js    # CRUD local de playlists y tracks
    │   ├── playlistDemo.js    # Modo demo (loadDemoPlaylist, exitDemoMode)
    │   ├── shuffleEngine.js   # Fisher-Yates + cola shuffle + repeat
    │   ├── playbackQueue.js   # playNextTrack / playPrevTrack
    │   ├── playerState.js     # Current track, queue, shuffle, repeat, playback state
    │   ├── modeState.js       # none / demo / servidor
    │   ├── authState.js       # Auth servidor (token) vs local (legacy), initAuth
    │   └── settingsState.js   # API Key, storage settings, background check options
    ├── components/            # UI Components (un archivo por funcionalidad, ~200 líneas)
    │   ├── common/            # Buttons, Modals, Badges, Inputs
    │   ├── layout/            # AppHeader, AppSidebar, LockScreen, WelcomeScreen...
    │   ├── player/            # Bottom Audio/Video Player Bar, Volume, Seekbar
    │   ├── playlist/          # PlaylistView (Header/Toolbar/Table), modals de edición
    │   └── settings/          # SettingsModal + secciones (API Key, Storage, Toggles)
    └── utils/                 # Fisher-Yates shuffle, fuzzy filter helpers
        └── helpers.js
```

---

## 🧩 Data Models

### Track Model

> **ToS data-retention policy (Developer Policies III.E.4):** `originalTitle` and `channelTitle` are **never persisted** — they are used in memory during parsing and discarded. API data (`thumbnailUrl`, `publishedAt`, `durationSeconds`) must be refreshed at least every 30 days (the link checker does this automatically in every sweep) and is purged when a broken link's recovery window expires. `title`/`artist` are user data (parsed once, freely editable) and are kept forever; `videoId` is kept as the link/anchor to the YouTube resource. The canonical typedef lives in `src/types/player.js`.

```js
/**
 * @typedef {Object} Track
 * @property {string} id - Internal UUID or YouTube Video ID
 * @property {string} videoId - YouTube Video ID (e.g. "dQw4w9WgXcQ"); link to the resource
 * @property {string} title - Song title (parsed from YouTube; user-editable; user data)
 * @property {string} artist - Artist name (parsed from YouTube; user-editable; user data)
 * @property {string} thumbnailUrl - Video thumbnail URL (API data; refreshable/purgable)
 * @property {string|null} publishedAt - Publication date in YouTube (ISO 8601; API data; purgable)
 * @property {number|null} durationSeconds - Track duration in seconds (API data; purgable)
 * @property {'healthy'|'warning'|'broken'|'unchecked'} status - Link health status
 * @property {string|null} statusMessage - Reason if warning/broken (e.g. "Private video", "Deleted")
 * @property {number|null} brokenAt - Timestamp when the broken link was first detected (null otherwise)
 * @property {number} metadataFetchedAt - Timestamp of last successful API metadata refresh (0 = pending)
 * @property {boolean} [removedFromSource] - True if the track is no longer present in the original YouTube playlist (sync-detected; track stays local with its metadata)
 * @property {number} addedAt - Timestamp when added
 * @property {number|null} lastCheckedAt - Timestamp of last integrity check
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
  - `clearAll(): Promise<void>` — full local data wipe (user-requested deletion, Developer Policies III.E.4.g)
  - `exportData(): Promise<string>`
  - `importData(jsonData: string): Promise<void>`
- Implementation switch via `storage/index.js` allowing seamless replacement with MongoDB/PostgreSQL backends without touching UI components.
- **Backup schema v2 (minimal user-library):** exports only `{ videoId, title, artist, addedAt, removedFromSource }` per track (+ playlist id/title/description/youtubePlaylistId). No YouTube API metadata travels in the file, so backups can be shared (e.g. Reddit) without redistributing API data. On import every track is marked `status: 'unchecked'` + `metadataFetchedAt: 0`, and the link-checker sweep repopulates thumbnails/dates/durations directly from YouTube under the importer's own credentials/quota.
- `LocalStorageAdapter.getPlaylists()` performs a silent migration of legacy tracks (strips persisted `originalTitle`/`channelTitle`, backfills `brokenAt`/`metadataFetchedAt`) and persists the clean model.

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
- Only re-checks tracks that are `unchecked`, in `warning`, stale (> 1 day since `lastCheckedAt`), with API metadata near the 30-day limit, or broken with an expired recovery window (pending purge) — so each session's sweep is light and doesn't repeat work. **Each track is queried at most once per day**: if it was checked today, it is skipped even across page reloads (avoids hammering the API).
- Checks availability via YouTube API (`videos.list?part=status,snippet,contentDetails`, same quota cost) or IFrame Player error triggers (errors 2, 5, 100, 101, 150 - the latter auto-marks the current track).
- **Every sweep doubles as a metadata refresh** (Developer Policies III.E.4): for live videos it renews `publishedAt`/`thumbnailUrl`/`durationSeconds` (and `metadataFetchedAt`) without ever touching user-edited `title`/`artist`. This keeps API data under the 30-day retention rule automatically.
- **Broken-link recovery window:** on first detection a track gets `brokenAt`; a badge tooltip shows the remaining days (`RECOVERY_WINDOW_MS` = 23 conservative days, since last valid metadata was ≤7 days old). If the link isn't repaired in time, the sweep purges the API metadata (thumbnail/date/duration) — `videoId`, `title` and `artist` are always kept so the user can still find a replacement.
- Flags unavailable tracks in UI with icon-only badges (tooltip on hover) and presents a quick "Find Replacement Link" option (search + swap videoId without losing custom metadata).

### 6. Playlist Sync with YouTube (startup refresh)

- Local playlists that have a `youtubePlaylistId` can be re-synced against YouTube (toggle `autoSyncPlaylists`, default ON). Manual actions (link check, sync, delete playlist) live in the Settings modal under "Mantenimiento de Playlists" (delete uses two-step confirm).
- On sync: **new tracks added to the YouTube playlist are appended at the end** (title/artist parsed in memory from the API response — original title/channel are discarded, not persisted; `status: 'unchecked'`), and tracks that were **removed from YouTube are flagged `removedFromSource: true` but stay local** with all custom metadata intact (nothing is lost).
- Sync never overwrites user-edited title/artist; it only updates playlist title/thumbnail/description.
- Re-adding songs to the *original* YouTube playlist requires OAuth (write API, out of scope with API key only) — the UI offers opening the video on YouTube to re-add manually.

---

## 🚀 Multi-Session Implementation Roadmap

### Phase 1: Project Setup & Storage Engine (Session 1)

- [x] Initialize Vite + Preact project structure.
- [x] Configure Tailwind CSS and the dark/glassmorphism design system.
- [ ] Build `StorageAdapter` interface, `IndexedDBAdapter` & `LocalStorageAdapter` (the interface and LocalStorage adapter are complete; IndexedDB remains pending).
- [x] Create initial state store using `@preact/signals`.

### Phase 2: YouTube API & Player Integration (Session 2)

- [x] Build `iframePlayer.js` wrapper around YouTube Iframe API.
- [x] Create persistent bottom Audio/Video Player component (Play/Pause, Seekbar, Volume, Mute, Fullscreen embed toggle).
- [x] Build API Key configuration UI & YouTube Data API fetcher for public playlists (private playlist OAuth remains out of scope).

### Phase 3: Track Management & Metadata Editor (Session 3)

- [x] Build Playlist view and track list table with sorting. Drag and drop reordering was intentionally removed.
- [x] Implement `metadataParser.js` (auto-extract artist & song title).
- [x] Add track editor modal (rename title, edit artist, swap video link through the repair modal).

### Phase 4: Custom Shuffle & Filtered Playback (Session 4)

- [x] Build smart Fisher-Yates shuffle engine with unplayed queue history.
- [x] Implement real-time title/artist search filter.
- [x] Connect search filtering directly to playback queue engine.

### Phase 5: Link Integrity Checker & Repair UI (Session 5)

- [x] Implement cascading background link checker worker (`linkChecker.js`).
- [x] Add visual badges (Healthy, Warning, Broken) in track lists.
- [x] Create "Broken Link Repair Modal" to search YouTube and update video ID without losing custom metadata.

### Phase 6: Polish, Testing & Export/Import (Session 6)

- [x] Add JSON backup export & import for offline database safety.
- [x] Add keyboard shortcuts (Space bar play/pause, arrows seek/volume, 'M' mute). Micro-animations are already present.
- [x] Add automated regression, integration, and browser-level tests for metadata editing, artist suggestions, JSON backup restore, and keyboard shortcuts. Manual visual verification remains pending.

### Phase 7: Version Split (Demo / Servidor) & UI Cleanup

- [x] App "modes" via `src/state/modeState.js` (`app_mode` in localStorage: `none`/`demo`/`servidor`). On first run (no playlists, mode `none`) a `WelcomeScreen` offers two buttons: **Demo** (navigates to the `/demo` route) and **Servidor** (personal API Key / future self-hosted instance).
- [x] **Demo lives at the `/demo` route** (pathname-based, no router lib; works on any base path since it matches the last path segment). Demo mode **never persists**: `storage/index.js` is a facade that swaps to `InMemoryStorageAdapter` when `modeState.isDemo` — refresh returns to the original `src/data/demoPlaylist.json` content. La demo también está **aislada a nivel de configuración** (`settingsState.js` es una fachada Proxy con fuentes persistentes vs de memoria según `isDemoActive()`, derivado de `src/state/demoRoute.js`): no lee `yt_api_key` ni los toggles del super usuario (arranca vacía/desactivados), y cualquier API key añadida en la demo solo vive en memoria (se descarta al recargar, nunca toca `localStorage`). `demoEnabled` es la única setting compartida (la decide el super usuario). `loadDemoPlaylist()`/`exitDemoMode()` in `playlistState.js`; demo playlist id `demo-playlist`. A "Modo demo" header badge and "Salir del modo demo" (redirects to root `/`) live in the playlist config modal. Wipe-all also resets mode to `none`.
- [x] Import button is enabled in **both** versions and opens `ImportPlaylistModal` with two tabs: **Desde YouTube** (paste link + accept) and **Nueva playlist local** (`createLocalPlaylist()` makes an empty editable playlist). In demo both are ephemeral (in-memory).
- [x] Per-playlist actions ("Revisar estado de los links", "Actualizar playlist desde YouTube", "Eliminar playlist activa") moved out of global Settings into `PlaylistSettingsModal`, opened via a wrench icon that appears on hover over the active playlist button in the sidebar. Global Settings only keeps API key, toggles, storage/backup, and wipe.
- [x] **Contraseña maestra (super usuario):** la contraseña **ya no vive en el navegador** en modo servidor: se valida contra el servidor (`POST /api/auth/*`, hash scrypt + token HMAC de 30 días). En local (sin servidor) se conserva el comportamiento legacy en `localStorage` (`yt_master_password`/`yt_session_expires_at`). Si hay contraseña configurada, la versión servidor muestra `LockScreen` (solo super usuario; estilo Trilium); al vencer la sesión se vuelve a pedir. En Ajustes de Usuario: establecer/cambiar/eliminar contraseña y "Bloquear ahora". La demo y la bienvenida quedan libres; en servidor bloqueado el boot **no carga datos** hasta desbloquear.
- [x] **Toggle "Habilitar versión demo"** (`yt_demo_enabled` en `settingsState.js`): el super usuario decide si la ruta `/demo` existe. Con la demo deshabilitada, `modeState` ignora la ruta `/demo`, `WelcomeScreen` oculta el botón Demo y solo queda el acceso servidor (con contraseña si la hay).
- [x] **Servidor (Hono + @hono/node-server, sin DB):** el servidor responde la web y la API en un solo proceso. Sirve `dist/` con fallback SPA (`, `/demo`, etc.) y monta `/api/auth`. La biblioteca **sigue viviendo en el `localStorage` del navegador** (espacio de sobra). **`.env` solo lleva el puerto (`PORT`)**; la configuración de la app vive en `server/.config.json` (gitignored, el "config.ini" del proyecto): `authSecret` (auto-generado), `masterPasswordHash` (scrypt), `noAuthentication` y `youtubeApiKey` (F3). `loadConfig()` relee el archivo en cada petición (sin caché), así que editarlo tiene efecto inmediato (sin reiniciar). Flujos: `npm run build` → `npm start` (test de la versión servidor); en dev, Vite (5173) con proxy `/api` → Hono (`npm run dev:server`, puerto 3000). `authState.js` ramifica por `modeState.isServer` (API/token `yt_session_token`) vs local (legacy). El boot hace `initAuth()` antes de decidir LockScreen/cargar datos (`authState.ready` evita el flash). **Recuperación de acceso (estilo Trilium, `noAuthentication: true` en `server/.config.json`):** desactiva la autenticación (status reporta `noAuthentication:true`, el unlock queda en bypass y `authState.authDisabled` muestra un aviso en Ajustes de Usuario) para restablecer la contraseña maestra desde la UI sin sesión; al volverla a `false`, se pide la nueva contraseña. Surte efecto inmediato (leído por petición).
- [x] **Respaldo al servidor sin base de datos (`/api/backup`, `server/routes/backup.js`):** el navegador empuja su `exportData()` (esquema v2, SOLO la biblioteca del usuario: `videoId`/`title`/`artist`/`addedAt`/`removedFromSource`; **nunca viajan la API key, toggles ni config del super usuario** — verificado por test) como JSON en `server/data/backups/` con rotación de 3 copias. Cliente: `src/api/backupSync.js` — push con debounce de 5s ante cualquier cambio de la biblioteca (efecto sobre `playlistState.playlists`) + red de seguridad cada 30 min + después del barrido del link checker (que también muta la señal); nunca empuja con biblioteca vacía (no pisa el respaldo con LockScreen/bienvenida) ni en demo. Restauración: `maybeRestoreFromServer()` en el boot si `yt_player_playlists` nunca se inicializó (navegador limpio / otro equipo) y botón **"Recuperar backup de servidor"** en Ajustes de Usuario y **"Restaurar desde servidor"** en Ajustes → Almacenamiento (reutilizan `importData`; los tracks quedan `unchecked` y el barrido repuebla metadata). El wipe ("Borrar todos mis datos") también borra el respaldo del servidor (`DELETE /api/backup`). Autenticación del endpoint: misma política que `/api/auth/password` (sin contraseña → abierto; con contraseña → exige token de sesión). Carpeta `server/data/` gitignored; `YT_BACKUP_DIR` permite aislar en tests.
- [ ] Future: **F3 — proxy YouTube server-side** (`/api/youtube/video-info|playlist|search|check`, `YOUTUBE_API_KEY` en `server/.env`, protegido por token de sesión; el navegador deja de conocer la key), OAuth (deferred), full-screen `.web/demo` route separation.

---

agy --conversation=e77f45cc-b3a8-4704-8956-c544e978c2e8

---

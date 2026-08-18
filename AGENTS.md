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
    │   ├── InMemoryStorageAdapter.js  # Demo (ruta /demo)
    │   ├── ServerStorageAdapter.js    # Biblioteca en el servidor (/api/library)
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
 * @property {string} videoId - YouTube Video ID (e.g. "dQw4w9WgXcQ"); link to the resource; **immutable anchor for sync**
 * @property {string|null} [playableVideoId] - Replacement video ID (embeddable copy); used ONLY for playback, never for sync identity
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
- **Migración de tracks legacy:** `src/storage/trackModel.js::migrateTrack()` (compartido por los adaptadores) purga `originalTitle`/`channelTitle` y completa `brokenAt`/`metadataFetchedAt`/`playableVideoId`. El modo local fue **eliminado**: la biblioteca vive siempre en el servidor (`ServerStorageAdapter`) o en memoria (`InMemoryStorageAdapter` en `/demo`); `LocalStorageAdapter` se eliminó del proyecto.

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

- **Copia reproducible (`playableVideoId`):** cuando un video está vivo pero tiene el embebido bloqueado (`embeddable:false` → `warning`), el modal de reparación guarda el reemplazo como **copia reproducible** en `playableVideoId` (el `videoId` original se conserva como ancla). El player usa `playableVideoId || videoId`; la sync matchea **solo** por `videoId`, así el tema no se duplica ni se marca `removedFromSource` al actualizar. Badge "reemplazo" en la tabla. Solo si el video original fue **eliminado** (`broken`) el reemplazo pasa a ser el `videoId` principal (el ancla se mueve) y `playableVideoId` se limpia.

- Runs a single sweep **once per session** (startup + after imports), politely paced to respect API quotas: **one batch of 50 video IDs per request, 1 batch per minute** (5s interval in manual mode).
- Only re-checks tracks that are `unchecked`, in `warning`, stale (> 1 day since `lastCheckedAt`), with API metadata near the 30-day limit, or broken with an expired recovery window (pending purge) — so each session's sweep is light and doesn't repeat work. **Each track is queried at most once per day**: if it was checked today, it is skipped even across page reloads (avoids hammering the API).
- Checks availability via YouTube API (`videos.list?part=status,snippet,contentDetails`, same quota cost) or IFrame Player error triggers (errors 2, 5, 100, 101, 150 - the latter auto-marks the current track). **El checker evalúa la copia reproducible cuando existe (`playableVideoId || videoId`)**: reparar un track con embed bloqueado ya no vuelve a marcarlo como aviso en el acto (la salud mostrada es la del video que realmente se reproduce); el ancla solo se conserva como identidad para la sync. El buscador de reemplazos (`/api/youtube/search`) cruza `videos.list?part=status` y descarta los resultados con el embed bloqueado o no públicos, y además verifica cada candidato con **oEmbed** (`www.youtube.com/oembed`, sin key ni cuota de la Data API; HTTP 401 = no incrustable): el `embeddable` de la API no refleja los bloqueos por Content ID de los sellos discográficos, que sí se detectan a nivel de reproductor.
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
- [x] Build `StorageAdapter` interface + adapters (the interface, `InMemoryStorageAdapter` and `ServerStorageAdapter` are complete; `LocalStorageAdapter`/IndexedDB fueron eliminados — la biblioteca vive en el servidor).
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
- [x] **Demo lives at the `/demo` route** (pathname-based, no router lib; works on any base path since it matches the last path segment). Demo mode **never persists**: `storage/index.js` is a facade that swaps to `InMemoryStorageAdapter` when `modeState.isDemo` (and to `ServerStorageAdapter` otherwise, since el modo local fue eliminado) — refresh returns to the original `src/data/demoPlaylist.json` content. La demo también está **aislada a nivel de configuración** (`settingsState.js` es una fachada Proxy con fuentes persistentes vs de memoria según `isDemoActive()`, derivado de `src/state/demoRoute.js`): no lee los toggles del super usuario (arranca desactivados), y cualquier cambio en la demo solo vive en memoria (se descarta al recargar). **`demoEnabled` (si la ruta /demo existe) es decisión del super usuario en el servidor** (`server/.config.json`): se cambia en Ajustes de Usuario (`POST /api/auth/settings`, misma autorización que `/password`) y el cliente lo lee de `/api/auth/status` (o `/unlock` y `/verify`) en `initAuth`/`reverify`/`unlock`; `modeState` reacciona en caliente si cambia. `loadDemoPlaylist()`/`exitDemoMode()` in `playlistState.js`; demo playlist id `demo-playlist`. A "Modo demo" header badge and "Salir del modo demo" (redirects to root `/`) live in the playlist config modal. Wipe-all also resets mode to `none`.
- [x] Import button is enabled in **both** versions and opens `ImportPlaylistModal` with two tabs: **Desde YouTube** (paste link + accept) and **Nueva playlist local** (`createLocalPlaylist()` makes an empty editable playlist). In demo both are ephemeral (in-memory).
- [x] Per-playlist actions ("Revisar estado de los links", "Actualizar playlist desde YouTube", "Eliminar playlist activa") moved out of global Settings into `PlaylistSettingsModal`, opened via a wrench icon that appears on hover over the active playlist button in the sidebar. Global Settings only keeps API key, toggles, storage/backup, and wipe.
- [x] **Contraseña maestra (super usuario):** la contraseña **no vive en el navegador**: se valida contra el servidor (`POST /api/auth/*`, hash scrypt + token HMAC de 30 días). El modo local fue eliminado (no hay auth legacy en localStorage). Si hay contraseña configurada, la versión servidor muestra `LockScreen` (solo super usuario; estilo Trilium); al vencer la sesión se vuelve a pedir. En Ajustes de Usuario: establecer/cambiar/eliminar contraseña y "Bloquear ahora". **Eliminar la contraseña deja la instancia abierta y marca `noAuthentication: true` en el servidor** (mismo estado que el modo recuperación → la UI avisa en lenguaje llano que la instancia es pública y recomienda fijar una contraseña); **fijar/cambiar la contraseña reactiva la autenticación automáticamente** (el servidor escribe `noAuthentication: false` en el config) y devuelve un token nuevo para no bloquearse a sí mismo. La demo y la bienvenida quedan libres; en servidor bloqueado el boot **no carga datos** hasta desbloquear.
- [x] **Registro de sesiones (`server/sessions.js`, `server/data/sessions.json`):** el servidor mantiene el "listado" de autorizaciones otorgadas — cada una con `grantedAt` (cuándo se otorgó, solo al desbloquear con la contraseña correcta en el LockScreen) y `expiresAt` (30 días). El token firmado referencia su `sid`; `verifySession()` exige que la sesión siga activa en el registro (no vencida ni revocada). **Revocación:** al fijar/cambiar/eliminar la contraseña se revocan TODAS las sesiones previas; "Bloquear ahora" (`POST /api/auth/lock`) revoca la sesión presentada. `GET /api/auth/verify` es la confirmación que el cliente pide periódicamente: manda su token (Authorization) y el servidor responde OK solo si la sesión está activa (en una instancia abierta siempre OK). La biblioteca (`/api/library`) valida con `verifySession`. `YT_SESSIONS_PATH` aísla en tests; archivo gitignored.
- [x] **`AuthGate` — envoltorio de seguridad (`src/components/layout/AuthGate.jsx`):** la app completa se monta DENTRO de este gate: `App()` = `<AuthGate><AppContent/></AuthGate>`. El gate llama `initAuth()` al montar y resuelve la autenticación ANTES de renderizar cualquier contenido — mientras consulta `/api/auth/status` muestra `SplashScreen` ("Verificando seguridad...") y si la sesión es privada (hay contraseña y no hay token válido) muestra `LockScreen` ("Sesión privada" + host). Solo con la sesión confirmada (o versión abierta sin contraseña) se monta `AppContent`, que es donde viven todos los efectos del boot (`storage.init()`, `loadLocalPlaylists`, sync, `runCascadingLinkCheck`, `initYouTubePlayer`). Con esto se garantiza que **antes de desbloquear NO se hace ninguna llamada a la API de YouTube ni a `/api/library`** (la biblioteca es privada y exige el token del servidor — el servidor responde 401 sin sesión, verificado por test y en vivo). La demo (/demo) queda libre: el gate la deja pasar sin consultar ni bloquear. El boot de `AppContent` corre con el auth ya resuelto (efecto dependiente de `isLocked`/`isServer`, sin `initAuth`). **Re-verificación continua (`reverify()`, cada 15 s y al recuperar el foco):** el cliente manda su token a `/api/auth/verify` y el servidor confirma con OK si la sesión sigue activa en su registro; si la configuración cambia (el super usuario exige contraseña) o la sesión fue revocada, la página **re-bloquea las conexiones ya abiertas sin recargar** (verificado en vivo).
- [x] **Toggle "Habilitar versión demo"** (`yt_demo_enabled` en `settingsState.js`): el super usuario decide si la ruta `/demo` existe. Con la demo deshabilitada, `modeState` ignora la ruta `/demo`, `WelcomeScreen` oculta el botón Demo y solo queda el acceso servidor (con contraseña si la hay).
- [x] **Servidor (Hono + @hono/node-server, sin DB):** el servidor responde la web y la API en un solo proceso. Sirve `dist/` con fallback SPA (`, `/demo`, etc.) y monta `/api/auth` + `/api/library`. **La biblioteca vive en el servidor** (`server/data/library.json`, la fuente de verdad multi-dispositivo); **el modo local fue eliminado — la app requiere el servidor** (si `/api/auth/status` falla al arrancar, `AuthGate` muestra `ServerUnreachableScreen` en vez de caer a localStorage). **`.env` solo lleva el puerto (`PORT`)**; la configuración de la app vive en `server/.config.json` (gitignored, el "config.ini" del proyecto): `authSecret` (auto-generado), `masterPasswordHash` (scrypt), `noAuthentication`, `youtubeApiKey` (F3) y `demoEnabled` (si la ruta /demo existe). `loadConfig()` relee el archivo en cada petición (sin caché), así que editarlo tiene efecto inmediato (sin reiniciar). Flujos: `npm run build` → `npm start` (test de la versión servidor); en dev, Vite (5173) con proxy `/api` → Hono (`npm run dev:server`, puerto 3000). `authState.js` usa SIEMPRE la API del servidor (token `yt_session_token`), sin rama legacy. El boot hace `initAuth()` antes de decidir LockScreen/cargar datos (`authState.ready` evita el flash). **Recuperación de acceso (estilo Trilium, `noAuthentication: true` en `server/.config.json`):** desactiva la autenticación (status reporta `noAuthentication:true`, el unlock queda en bypass y `authState.authDisabled` muestra un aviso en Ajustes de Usuario de que la instancia es pública) para restablecer la contraseña maestra desde la UI sin sesión; **al fijar una contraseña nueva, el servidor reactiva la autenticación automáticamente** (escribe `noAuthentication: false` y devuelve una sesión). Surte efecto inmediato (leído por petición).
- [x] **Biblioteca en el servidor (`/api/library`, `server/routes/library.js`):** la biblioteca ya NO vive en `localStorage` en modo servidor — es la fuente de verdad multi-dispositivo. `src/storage/ServerStorageAdapter.js` implementa el contrato `StorageAdapter` (misma fachada en `src/storage/index.js` que elige adaptador por modo: servidor → servidor, `/demo` → memoria): mantiene una caché de `{ version, playlists }`, cada mutación (`savePlaylist`/`deletePlaylist`/`updateTrack`/`clearAll`/`importData`) la aplica en memoria y programa un **PUT debounced (300 ms)** a `/api/library` con reintento con backoff (2 s) mientras la pestaña esté abierta; `pagehide` hace un flush best-effort con `navigator.sendBeacon` (POST, alias del PUT). **Migración única automática:** en el primer arranque, si el servidor está vacío y el navegador tiene la key legacy `yt_player_playlists`, la sube al servidor (limpiando `originalTitle`/`channelTitle` vía `migrateTrack`) y elimina la copia local al confirmarse el guardado. Los helpers de normalización viven en `src/storage/trackModel.js` (compartidos por los dos adaptadores). El wipe ("Borrar todos mis datos") vacía la biblioteca del servidor (PUT `[]`) y, en modo servidor, además elimina la contraseña maestra (el servidor marca `noAuthentication: true` — instancia nueva y abierta). Autenticación del endpoint: misma política que `/api/auth/password` (sin contraseña → abierto; con contraseña → exige token de sesión). El documento **nunca contiene config del super usuario** (apiKey/toggles/password) — verificado por test. Carpeta `server/data/` gitignored; `YT_LIBRARY_PATH` permite aislar en tests. El sistema previo de respaldo (`/api/backup` rotativo + `src/api/backupSync.js` + botones "Recuperar backup/Restaurar desde servidor") quedó **eliminado**.
- [x] **F3 — proxy YouTube server-side (`server/routes/youtube.js`):** el navegador ya NO conoce ni guarda la YouTube Data API key — se configura en `ApiKeySection` y vive solo en `server/.config.json` (`youtubeApiKey`, nunca en `localStorage`). Endpoints: `GET /api/youtube/status` (reporta si hay key), `POST /api/youtube/key` (validada contra Google antes de persistir), `DELETE /api/youtube/key`, `GET /api/youtube/videos?ids=...` (chequeo de links), `GET /api/youtube/playlist?listId=...` (import/sync con paginación), `GET /api/youtube/search?q=...` (modal de reemplazo; **cruza los resultados con `videos.list?part=status` y descarta los que tienen el embed bloqueado o no son públicos** — el reemplazo siempre es reproducible desde el iframe). Protegidos con la misma autorización que `/api/library` (abierta sin contraseña; token de sesión si hay). `youtubeApi.js` es la única puerta cliente, con `guardDemo()` (la demo nunca toca la key del super usuario). El playback sigue siendo 100% client-side (IFrame Player API); el proxy es solo Data API. Tests en `tests/serverYoutube.test.mjs`. Future: OAuth (deferred), full-screen `.web/demo` route separation.

---

agy --conversation=e77f45cc-b3a8-4704-8956-c544e978c2e8

---

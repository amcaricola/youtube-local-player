import { signal, computed, effect } from '@preact/signals';

/**
 * Estado central de playlists y su vista (filtros, orden, paginación).
 * Las operaciones de importación/sincronización viven en `playlistImports.js`,
 * el CRUD local en `playlistCrud.js`, la demo en `playlistDemo.js` y el
 * motor de reproducción en `shuffleEngine.js` / `playbackQueue.js`.
 */
export const playlistState = {
  playlists: signal([]),
  activePlaylist: signal(null),
  isLoading: signal(false),
  error: signal(null),
  searchQuery: signal(''),
  artistFilters: signal([]),
  problemFilter: signal(false),
  isShuffle: signal(false),
  repeatMode: signal('off'),
  shuffledQueue: signal([]),
  playedHistory: signal([]),
  editingTrack: signal(null),
  repairTrack: signal(null),
  toast: signal(null),
  isImportOpen: signal(false),
  isAddTrackOpen: signal(false),
  isPlaylistSettingsOpen: signal(false),
  showDemoIntro: signal(false),
  isSyncing: signal(false),
  syncNotice: signal(null),
  visibleLimit: signal(100),
  sortKey: signal(null),
  sortDirection: signal('asc')
};

/**
 * Tracks visibles de la playlist activa según búsqueda, filtro de artistas,
 * filtro de problemas y orden. Shuffle y cola operan sobre esta lista.
 */
export const filteredTracks = computed(() => {
  const active = playlistState.activePlaylist.value;
  if (!active) return [];
  const query = playlistState.searchQuery.value.trim().toLowerCase();
  const artistFilters = playlistState.artistFilters.value.map(name => name.toLowerCase());

  let tracks = active.tracks;
  if (playlistState.problemFilter.value) {
    tracks = tracks.filter(t => t.status === 'broken' || t.status === 'warning');
  }
  if (artistFilters.length > 0) {
    tracks = tracks.filter(t => artistFilters.some(name => t.artist.toLowerCase().includes(name)));
  }
  if (query) {
    tracks = tracks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.artist.toLowerCase().includes(query)
    );
  }

  const sortKey = playlistState.sortKey.value;
  if (sortKey && (sortKey === 'title' || sortKey === 'artist' || sortKey === 'publishedAt')) {
    const dir = playlistState.sortDirection.value === 'desc' ? -1 : 1;
    tracks = [...tracks].sort((a, b) => {
      if (sortKey === 'publishedAt') {
        const av = a.publishedAt || '';
        const bv = b.publishedAt || '';
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return av.localeCompare(bv) * dir;
      }
      const av = (a[sortKey] || '').toString().toLowerCase();
      const bv = (b[sortKey] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }

  return tracks;
});

/** Conteo de tracks con problemas (roto / aviso) de la playlist activa. */
export const problemCounts = computed(() => {
  const active = playlistState.activePlaylist.value;
  if (!active) return { broken: 0, warning: 0 };
  let broken = 0;
  let warning = 0;
  for (const t of active.tracks) {
    if (t.status === 'broken') broken++;
    else if (t.status === 'warning') warning++;
  }
  return { broken, warning };
});

/** Cicla el orden de la columna: asc → desc → desactivado. */
export const toggleSort = (key) => {
  if (playlistState.sortKey.value !== key) {
    playlistState.sortKey.value = key;
    playlistState.sortDirection.value = 'asc';
  } else if (playlistState.sortDirection.value === 'asc') {
    playlistState.sortDirection.value = 'desc';
  } else {
    playlistState.sortKey.value = null;
    playlistState.sortDirection.value = 'asc';
  }
};

let toastTimeout = null;
export const showToast = (message) => {
  playlistState.toast.value = message;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    playlistState.toast.value = null;
  }, 3000);
};

// Al cambiar playlist, búsqueda o filtro de problemas, vuelve a la vista paginada inicial.
// (La paginación es solo visual: shuffle y filtrado usan la lista completa)
effect(() => {
  playlistState.searchQuery.value;
  playlistState.artistFilters.value;
  playlistState.problemFilter.value;
  playlistState.activePlaylist.value;
  playlistState.visibleLimit.value = 100;
});

// Al cambiar de playlist, los filtros y el orden vuelven a su estado inicial.
// Solo se reinicia cuando cambia el id de la playlist (no al reemplazarse en una sincronización).
let lastFilterPlaylistId = null;
effect(() => {
  const activeId = playlistState.activePlaylist.value?.id ?? null;
  if (activeId === lastFilterPlaylistId) return;
  lastFilterPlaylistId = activeId;
  playlistState.searchQuery.value = '';
  playlistState.artistFilters.value = [];
  playlistState.problemFilter.value = false;
  playlistState.sortKey.value = null;
  playlistState.sortDirection.value = 'asc';
});
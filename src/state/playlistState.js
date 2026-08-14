import { signal, computed, effect } from '@preact/signals';
import { fetchPlaylistData } from '../api/youtubeApi.js';
import { parseTrackMetadata } from '../api/metadataParser.js';
import storage from '../storage/index.js';
import { playerState } from './playerState.js';
import { settingsState } from './settingsState.js';

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
  isSyncing: signal(false),
  syncNotice: signal(null),
  visibleLimit: signal(100),
  sortKey: signal(null),
  sortDirection: signal('asc')
};

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

let toastTimeout = null;
export const showToast = (message) => {
  playlistState.toast.value = message;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    playlistState.toast.value = null;
  }, 3000);
};

export const generateShuffle = (tracks, excludeTrackId = null) => {
  let queue = tracks.map(t => t.id);
  // Fisher-Yates
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (excludeTrackId) {
    queue = queue.filter(id => id !== excludeTrackId);
  }
  return queue;
};

export const toggleShuffle = () => {
  playlistState.isShuffle.value = !playlistState.isShuffle.value;
  if (playlistState.isShuffle.value) {
    const current = playerState.currentTrack.value;
    playlistState.shuffledQueue.value = generateShuffle(filteredTracks.value, current?.id);
    playlistState.playedHistory.value = current ? [current.id] : [];
  } else {
    playlistState.shuffledQueue.value = [];
  }
};

export const cycleRepeatMode = () => {
  const modes = ['off', 'all', 'one'];
  const current = playlistState.repeatMode.value;
  const next = modes[(modes.indexOf(current) + 1) % modes.length];
  playlistState.repeatMode.value = next;
};

// Cuando el filtro de búsqueda cambia con shuffle activo, regenera la cola
// para que el shuffle solo reproduzca canciones de la lista filtrada actual.
effect(() => {
  filteredTracks.value;
  if (playlistState.isShuffle.value) {
    const current = playerState.currentTrack.value;
    playlistState.shuffledQueue.value = generateShuffle(filteredTracks.value, current?.id);
    playlistState.playedHistory.value = current ? [current.id] : [];
  }
});

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

/**
 * Carga las playlists desde el storage local
 */
export const loadLocalPlaylists = async () => {
  const lists = await storage.getPlaylists();
  playlistState.playlists.value = lists;
  if (lists.length > 0 && !playlistState.activePlaylist.value) {
    playlistState.activePlaylist.value = lists[0];
  }
};

/**
 * Transforma los items crudos de la API de YouTube a nuestro modelo Track.
 * El título original y el canal se usan solo en memoria para el parseo y se
 * descartan (Developer Policies III.E.4): solo persistimos título/artista
 * (datos del usuario), el videoId (enlace al recurso) y la metadata mínima
 * refrescable (miniatura, fecha de publicación).
 * @param {Array} rawItems
 */
const mapRawItemsToTracks = (rawItems) => rawItems
  .filter(item => item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video')
  .map(item => {
    const { title, artist } = parseTrackMetadata(item.snippet.title, item.snippet.videoOwnerChannelTitle || '');
    const now = Date.now();

    return {
      id: item.contentDetails.videoId,
      videoId: item.contentDetails.videoId,
      title,
      artist,
      thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
      publishedAt: item.contentDetails?.videoPublishedAt || null,
      durationSeconds: null, // la completa el link checker en su primer barrido
      status: 'unchecked',
      statusMessage: null,
      brokenAt: null,
      metadataFetchedAt: now,
      removedFromSource: false,
      addedAt: now,
      lastCheckedAt: null
    };
  });

/**
 * Importa y parsea una playlist desde YouTube a la base de datos local
 * @param {string} playlistId 
 * @param {string} apiKey 
 */
export const importYouTubePlaylist = async (playlistId, apiKey) => {
  playlistState.isLoading.value = true;
  playlistState.error.value = null;
  
  try {
    const data = await fetchPlaylistData(playlistId, apiKey);
    
    const newPlaylist = {
      id: `pl_${Date.now()}`,
      youtubePlaylistId: data.youtubePlaylistId,
      title: data.title,
      description: data.description,
      thumbnail: data.thumbnail,
      tracks: mapRawItemsToTracks(data.rawItems),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Guardar en la persistencia local
    await storage.savePlaylist(newPlaylist);
    await loadLocalPlaylists();
    
    playlistState.activePlaylist.value = newPlaylist;
    
  } catch (error) {
    console.error("Error al importar playlist:", error);
    playlistState.error.value = error.message;
  } finally {
    playlistState.isLoading.value = false;
  }
};

/**
 * Sincroniza una playlist local con su versión en YouTube:
 * - Agrega al final las canciones nuevas añadidas en YouTube.
 * - Marca con `removedFromSource` las que ya no están en la playlist de
 *   YouTube (se conservan en local con su metadata para no perder nada).
 * - Nunca pisa los metadatos editados por el usuario.
 * @param {import('../types/player.js').Playlist} playlist
 * @param {string} apiKey
 * @returns {Promise<{added: number, removed: number}|null>}
 */
export const syncPlaylistWithYouTube = async (playlist, apiKey) => {
  if (!playlist?.youtubePlaylistId) return null;
  playlistState.isSyncing.value = true;

  try {
    const data = await fetchPlaylistData(playlist.youtubePlaylistId, apiKey);
    const remoteTracks = mapRawItemsToTracks(data.rawItems);
    const remoteIds = new Set(remoteTracks.map(t => t.videoId));
    const localIds = new Set(playlist.tracks.map(t => t.videoId));

    const newTracks = remoteTracks.filter(t => !localIds.has(t.videoId));
    const existing = playlist.tracks.map(t => ({
      ...t,
      removedFromSource: !remoteIds.has(t.videoId)
    }));

    const updated = {
      ...playlist,
      title: data.title || playlist.title,
      description: data.description ?? playlist.description,
      thumbnail: data.thumbnail || playlist.thumbnail,
      tracks: [...existing, ...newTracks],
      updatedAt: Date.now()
    };

    await storage.savePlaylist(updated);
    await loadLocalPlaylists();

    if (playlistState.activePlaylist.value?.id === playlist.id) {
      playlistState.activePlaylist.value = updated;
    }

    return {
      added: newTracks.length,
      removed: existing.filter(t => t.removedFromSource).length
    };
  } finally {
    playlistState.isSyncing.value = false;
  }
};

/**
 * Sincroniza todas las playlists locales que tienen origen en YouTube,
 * de forma secuencial y con un pequeño respiro entre cada una.
 * @returns {Promise<Array<{title: string, added: number, removed: number}>>}
 */
export const syncAllPlaylists = async () => {
  const apiKey = settingsState.apiKey.value;
  if (!apiKey) return [];

  const results = [];
  for (const playlist of [...playlistState.playlists.value]) {
    if (!playlist.youtubePlaylistId) continue;
    try {
      const result = await syncPlaylistWithYouTube(playlist, apiKey);
      if (result) {
        results.push({ title: playlist.title, ...result });
      }
    } catch (error) {
      console.error(`Error al sincronizar "${playlist.title}":`, error);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  return results;
};

/**
 * Actualiza los metadatos de un track y los persiste en el storage.
 * También refleja el cambio en la canción actualmente reproducida.
 * @param {string} playlistId 
 * @param {string} trackId 
 * @param {Partial<import('../types/player.js').Track>} updates 
 */
export const updateTrackMetadata = async (playlistId, trackId, updates) => {
  await storage.updateTrack(playlistId, trackId, updates);

  const applyUpdate = (playlist) => ({
    ...playlist,
    tracks: playlist.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
  });

  playlistState.playlists.value = playlistState.playlists.value.map(pl =>
    pl.id === playlistId ? applyUpdate(pl) : pl
  );

  const active = playlistState.activePlaylist.value;
  if (active && active.id === playlistId) {
    playlistState.activePlaylist.value = applyUpdate(active);
  }

  if (playerState.currentTrack.value?.id === trackId) {
    playerState.currentTrack.value = { ...playerState.currentTrack.value, ...updates };
  }
};

/**
 * Elimina una playlist completa del storage local.
 * @param {string} playlistId
 */
export const deletePlaylist = async (playlistId) => {
  await storage.deletePlaylist(playlistId);
  await loadLocalPlaylists();
  if (playlistState.activePlaylist.value?.id === playlistId) {
    playlistState.activePlaylist.value = playlistState.playlists.value[0] || null;
  }
};

/**
 * Elimina una canción de la playlist local (persistida en storage).
 * @param {string} playlistId
 * @param {string} trackId
 */
export const removeTrackFromPlaylist = async (playlistId, trackId) => {
  const playlists = await storage.getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
    await storage.savePlaylist(playlist);
  }

  const applyRemove = (pl) => ({ ...pl, tracks: pl.tracks.filter(t => t.id !== trackId) });
  playlistState.playlists.value = playlistState.playlists.value.map(pl =>
    pl.id === playlistId ? applyRemove(pl) : pl
  );
  if (playlistState.activePlaylist.value?.id === playlistId) {
    playlistState.activePlaylist.value = applyRemove(playlistState.activePlaylist.value);
  }
};

/**
 * Reproduce la siguiente canción de la lista activa
 */
export const playNextTrack = () => {
  const active = playlistState.activePlaylist.value;
  const current = playerState.currentTrack.value;
  if (!active) return;
  
  const tracks = filteredTracks.value;
  if (tracks.length === 0) return;

  import('../api/iframePlayer.js').then(({ playTrack }) => {
    if (playlistState.isShuffle.value) {
      let queue = [...playlistState.shuffledQueue.value];
      if (queue.length === 0) {
        // La cola se agotó: solo se vuelve a llenar si el modo lo permite
        if (playlistState.repeatMode.value === 'off') return;
        playlistState.shuffledQueue.value = generateShuffle(tracks, current?.id);
        playlistState.playedHistory.value = [];
        queue = [...playlistState.shuffledQueue.value];
      }
      let nextId = queue.shift();
      // Saltar IDs duplicados del video recién terminado para evitar un loop ENDED->loadVideoById
      while (nextId && current && nextId === current.id) {
        nextId = queue.shift();
      }
      playlistState.shuffledQueue.value = queue;

      const nextTrack = tracks.find(t => t.id === nextId);
      if (nextTrack) {
        if (current) {
          playlistState.playedHistory.value = [...playlistState.playedHistory.value, current.id];
        }
        playTrack(nextTrack);
      }
    } else {
      if (!current) {
        playTrack(tracks[0]);
        return;
      }
      const currentIndex = tracks.findIndex(t => t.id === current.id);
      if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
        playTrack(tracks[currentIndex + 1]);
      } else if (playlistState.repeatMode.value === 'all') {
        // Loop back to start
        playTrack(tracks[0]);
      }
    }
  });
};

/**
 * Reproduce la canción anterior de la lista activa
 */
export const playPrevTrack = () => {
  const active = playlistState.activePlaylist.value;
  const current = playerState.currentTrack.value;
  if (!active || !current) return;
  
  // Si lleva más de 3 segundos, reiniciar la canción actual
  if (playerState.currentTime.value > 3) {
    import('../api/iframePlayer.js').then(({ seekTo }) => {
      seekTo(0);
    });
    return;
  }
  
  const tracks = filteredTracks.value;

  import('../api/iframePlayer.js').then(({ playTrack }) => {
    if (playlistState.isShuffle.value) {
      if (playlistState.playedHistory.value.length > 0) {
        const history = [...playlistState.playedHistory.value];
        const prevId = history.pop();
        playlistState.playedHistory.value = history;
        
        playlistState.shuffledQueue.value = [current.id, ...playlistState.shuffledQueue.value];
        const prevTrack = tracks.find(t => t.id === prevId);
        if (prevTrack) playTrack(prevTrack);
      } else {
        import('../api/iframePlayer.js').then(({ seekTo }) => seekTo(0));
      }
    } else {
      const currentIndex = tracks.findIndex(t => t.id === current.id);
      if (currentIndex > 0) {
        playTrack(tracks[currentIndex - 1]);
      } else {
        playTrack(tracks[tracks.length - 1]);
      }
    }
  });
};

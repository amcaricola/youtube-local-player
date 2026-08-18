/**
 * Helpers de modelo de Track compartidos por los adaptadores de almacenamiento
 * (Local, Memoria, Servidor) para que la normalización sea idéntica en todos.
 */

/**
 * Migra un track persistido al modelo limpio:
 * - elimina `originalTitle`/`channelTitle` (API data que ya no se conserva)
 * - completa los campos de retención (brokenAt, metadataFetchedAt, durationSeconds)
 * Devuelve [trackLimpio, huboCambios].
 */
export const migrateTrack = (track) => {
  const { originalTitle, channelTitle, ...rest } = track;
  const migrated = {
    durationSeconds: null,
    statusMessage: null,
    brokenAt: null,
    removedFromSource: false,
    lastCheckedAt: null,
    playableVideoId: null,
    ...rest
  };
  if (migrated.status === 'broken' && !migrated.brokenAt) {
    migrated.brokenAt = migrated.lastCheckedAt || migrated.addedAt || Date.now();
  }
  if (migrated.metadataFetchedAt == null) {
    // Solo tracks legacy sin el campo: un 0 explícito significa "pendiente de refresh"
    // (tracks importados de un respaldo) y debe conservarse.
    migrated.metadataFetchedAt = migrated.lastCheckedAt || migrated.addedAt || Date.now();
  }
  const changed = originalTitle !== undefined || channelTitle !== undefined ||
    migrated.brokenAt !== track.brokenAt ||
    migrated.metadataFetchedAt !== track.metadataFetchedAt ||
    migrated.playableVideoId !== track.playableVideoId;
  return [migrated, changed];
};

/**
 * Esquema mínimo de respaldo (v2): solo la biblioteca del usuario
 * (IDs de video + título/artista editables). La metadata de la API
 * (fecha, miniatura, duración) NO viaja en el archivo: al importar,
 * los tracks quedan sin verificar y el link checker la repuebla
 * directamente desde YouTube.
 */
export const toBackupTrack = (t) => ({
  videoId: t.videoId,
  playableVideoId: t.playableVideoId ?? null,
  title: t.title,
  artist: t.artist,
  addedAt: t.addedAt ?? null,
  removedFromSource: !!t.removedFromSource
});

/**
 * Normaliza un track importado (v2 o legacy v1) al modelo limpio,
 * marcándolo como no verificado para que el barrido lo revalide.
 */
export const fromBackupTrack = (t, now) => ({
  id: t.id || t.videoId,
  videoId: t.videoId,
  playableVideoId: t.playableVideoId || null,
  title: t.title || 'Sin título',
  artist: t.artist || 'Desconocido',
  thumbnailUrl: '',
  publishedAt: null,
  durationSeconds: null,
  status: 'unchecked',
  statusMessage: null,
  brokenAt: null,
  metadataFetchedAt: 0,
  removedFromSource: !!t.removedFromSource,
  addedAt: t.addedAt || now,
  lastCheckedAt: null
});

/**
 * Normaliza una playlist completa importada al modelo limpio.
 * @returns {import('../types/player.js').Playlist[]}
 */
export const playlistsFromBackup = (data, now = Date.now()) => data.playlists.map((pl, i) => ({
  id: pl.id || `pl_${now}_${i}`,
  youtubePlaylistId: pl.youtubePlaylistId ?? null,
  title: pl.title || 'Playlist importada',
  description: pl.description || '',
  thumbnail: pl.thumbnail || '',
  tracks: (Array.isArray(pl.tracks) ? pl.tracks : [])
    .filter(t => t && t.videoId)
    .map(t => fromBackupTrack(t, now)),
  createdAt: pl.createdAt || now,
  updatedAt: now
}));

/** Serializa playlists al esquema de respaldo v2 (solo biblioteca del usuario). */
export const exportPlaylists = (playlists) => JSON.stringify({
  version: 2,
  exportedAt: new Date().toISOString(),
  playlists: playlists.map(pl => ({
    id: pl.id,
    youtubePlaylistId: pl.youtubePlaylistId ?? null,
    title: pl.title,
    description: pl.description ?? '',
    createdAt: pl.createdAt ?? null,
    tracks: (pl.tracks || []).map(toBackupTrack)
  }))
});
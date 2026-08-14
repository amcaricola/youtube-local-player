import { StorageAdapter } from './StorageAdapter.js';

const STORAGE_KEY = 'yt_player_playlists';

/**
 * Migra un track persistido al modelo limpio:
 * - elimina `originalTitle`/`channelTitle` (API data que ya no se conserva)
 * - completa los campos de retención (brokenAt, metadataFetchedAt, durationSeconds)
 * Devuelve [trackLimpio, huboCambios].
 */
const migrateTrack = (track) => {
  const { originalTitle, channelTitle, ...rest } = track;
  const migrated = {
    durationSeconds: null,
    statusMessage: null,
    brokenAt: null,
    removedFromSource: false,
    lastCheckedAt: null,
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
    migrated.metadataFetchedAt !== track.metadataFetchedAt;
  return [migrated, changed];
};

/**
 * Esquema mínimo de respaldo (v2): solo la biblioteca del usuario
 * (IDs de video + título/artista editables). La metadata de la API
 * (fecha, miniatura, duración) NO viaja en el archivo: al importar,
 * los tracks quedan sin verificar y el link checker la repuebla
 * directamente desde YouTube.
 */
const toBackupTrack = (t) => ({
  videoId: t.videoId,
  title: t.title,
  artist: t.artist,
  addedAt: t.addedAt ?? null,
  removedFromSource: !!t.removedFromSource
});

/**
 * Normaliza un track importado (v2 o legacy v1) al modelo limpio,
 * marcándolo como no verificado para que el barrido lo revalide.
 */
const fromBackupTrack = (t, now) => ({
  id: t.id || t.videoId,
  videoId: t.videoId,
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
 * LocalStorage implementation of StorageAdapter.
 * Suitable for initial phase, but limited to ~5MB.
 */
export class LocalStorageAdapter extends StorageAdapter {
  async init() {
    // LocalStorage doesn't require async initialization
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  }

  async getPlaylists() {
    const data = localStorage.getItem(STORAGE_KEY);
    const playlists = data ? JSON.parse(data) : [];

    // Migración silenciosa de tracks al modelo limpio (se persiste solo si hubo cambios)
    let dirty = false;
    const migrated = playlists.map(playlist => {
      if (!Array.isArray(playlist.tracks)) return playlist;
      let playlistDirty = false;
      const tracks = playlist.tracks.map(track => {
        const [clean, changed] = migrateTrack(track);
        if (changed) playlistDirty = true;
        return clean;
      });
      if (!playlistDirty) return playlist;
      dirty = true;
      return { ...playlist, tracks };
    });
    if (dirty) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  }

  async savePlaylist(playlist) {
    const playlists = await this.getPlaylists();
    const index = playlists.findIndex(p => p.id === playlist.id);

    if (index >= 0) {
      playlists[index] = playlist;
    } else {
      playlists.push(playlist);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  }

  async deletePlaylist(id) {
    const playlists = await this.getPlaylists();
    const filtered = playlists.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  async updateTrack(playlistId, trackId, updates) {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);

    if (playlist) {
      const trackIndex = playlist.tracks.findIndex(t => t.id === trackId);
      if (trackIndex >= 0) {
        playlist.tracks[trackIndex] = { ...playlist.tracks[trackIndex], ...updates };
        await this.savePlaylist(playlist);
      }
    }
  }

  async clearAll() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }

  async exportData() {
    const playlists = await this.getPlaylists();
    const backup = playlists.map(pl => ({
      id: pl.id,
      youtubePlaylistId: pl.youtubePlaylistId ?? null,
      title: pl.title,
      description: pl.description ?? '',
      createdAt: pl.createdAt ?? null,
      tracks: (pl.tracks || []).map(toBackupTrack)
    }));
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), playlists: backup });
  }

  async importData(jsonData) {
    let data;
    try {
      data = JSON.parse(jsonData);
    } catch (e) {
      throw new Error('Failed to parse backup data');
    }
    if (!data || !Array.isArray(data.playlists)) {
      throw new Error('Failed to parse backup data');
    }

    const now = Date.now();
    const playlists = data.playlists.map((pl, i) => ({
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  }
}

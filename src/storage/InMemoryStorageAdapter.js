import { StorageAdapter } from './StorageAdapter.js';

const toBackupTrack = (t) => ({
  videoId: t.videoId,
  title: t.title,
  artist: t.artist,
  addedAt: t.addedAt ?? null,
  removedFromSource: !!t.removedFromSource
});

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
 * Storage de solo memoria, usado en el modo demo (ruta `/demo`):
 * nada se persiste en localStorage, así al refrescar la página se pierde
 * todo y la demo vuelve a su contenido original del JSON local.
 */
export class InMemoryStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.playlists = [];
  }

  async init() {}

  async getPlaylists() {
    return this.playlists;
  }

  async savePlaylist(playlist) {
    const index = this.playlists.findIndex(p => p.id === playlist.id);
    if (index >= 0) {
      this.playlists[index] = playlist;
    } else {
      this.playlists.push(playlist);
    }
  }

  async deletePlaylist(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
  }

  async updateTrack(playlistId, trackId, updates) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (playlist) {
      const trackIndex = playlist.tracks.findIndex(t => t.id === trackId);
      if (trackIndex >= 0) {
        playlist.tracks[trackIndex] = { ...playlist.tracks[trackIndex], ...updates };
      }
    }
  }

  async clearAll() {
    this.playlists = [];
  }

  async exportData() {
    const backup = this.playlists.map(pl => ({
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
    this.playlists = data.playlists.map((pl, i) => ({
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
  }
}
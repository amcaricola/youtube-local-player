import { StorageAdapter } from './StorageAdapter.js';
import { exportPlaylists, playlistsFromBackup } from './trackModel.js';

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
    return exportPlaylists(this.playlists);
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

    this.playlists = playlistsFromBackup(data);
  }
}
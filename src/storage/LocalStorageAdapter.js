import { StorageAdapter } from './StorageAdapter.js';

const STORAGE_KEY = 'yt_player_playlists';

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
    return data ? JSON.parse(data) : [];
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

  async exportData() {
    const playlists = await this.getPlaylists();
    return JSON.stringify({ playlists, version: 1 });
  }

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (data.playlists && Array.isArray(data.playlists)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.playlists));
      } else {
        throw new Error('Invalid backup format');
      }
    } catch (e) {
      throw new Error('Failed to parse backup data');
    }
  }
}

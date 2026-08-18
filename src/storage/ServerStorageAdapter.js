import { StorageAdapter } from './StorageAdapter.js';
import { migrateTrack, exportPlaylists, playlistsFromBackup } from './trackModel.js';

const LEGACY_KEY = 'yt_player_playlists';
const DEBOUNCE_MS = 300;
const RETRY_MS = 2000;

const authHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('yt_session_token') : '';
  return token ? { Authorization: token } : {};
};

/**
 * Storage en el servidor (fuente de verdad multi-dispositivo, sin DB).
 * Mantiene una caché del documento `{ version, playlists }`; cada mutación
 * actualiza la caché y programa un PUT debounced. Si el guardado falla
 * (red/sesión) se reintenta con backoff mientras la pestaña esté abierta.
 * En el primer arranque migra los datos legacy de localStorage al servidor.
 */
export class ServerStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.cache = [];
    this.loaded = false;
    this.dirty = false;
    this.saveTimer = null;
    this.retryTimer = null;
    this.saving = false;

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      window.addEventListener('pagehide', () => {
        if (!this.dirty) return;
        const payload = new Blob([JSON.stringify({ version: 2, playlists: this.cache })], { type: 'application/json' });
        navigator.sendBeacon('/api/library', payload);
      });
    }
  }

  async init() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const res = await fetch('/api/library', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.cache = Array.isArray(data.playlists) ? data.playlists : [];
      } else {
        this.cache = [];
      }
    } catch {
      this.cache = [];
    }
    // Migración única: servidor vacío + datos legacy en este navegador → subirlos.
    if (this.cache.length === 0) {
      await this.migrateLegacyLocalData();
    }
  }

  /** Sube la biblioteca de localStorage (versión anterior) al servidor y la descarta. */
  async migrateLegacyLocalData() {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    let playlists;
    try {
      playlists = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(playlists) || playlists.length === 0) return;

    const migrated = playlists.map(pl => {
      if (!Array.isArray(pl.tracks)) return pl;
      return { ...pl, tracks: pl.tracks.map(t => migrateTrack(t)[0]) };
    });
    this.cache = migrated;
    this.dirty = true;
    this.pendingLegacyCleanup = true;
    await this.flush();
  }

  async getPlaylists() {
    if (!this.loaded) await this.init();
    return this.cache;
  }

  async savePlaylist(playlist) {
    if (!this.loaded) await this.init();
    const index = this.cache.findIndex(p => p.id === playlist.id);
    if (index >= 0) {
      this.cache[index] = playlist;
    } else {
      this.cache.push(playlist);
    }
    this.scheduleSave();
  }

  async deletePlaylist(id) {
    if (!this.loaded) await this.init();
    this.cache = this.cache.filter(p => p.id !== id);
    this.scheduleSave();
  }

  async updateTrack(playlistId, trackId, updates) {
    if (!this.loaded) await this.init();
    const playlist = this.cache.find(p => p.id === playlistId);
    if (playlist) {
      const trackIndex = playlist.tracks.findIndex(t => t.id === trackId);
      if (trackIndex >= 0) {
        playlist.tracks[trackIndex] = { ...playlist.tracks[trackIndex], ...updates };
        this.scheduleSave();
      }
    }
  }

  async clearAll() {
    if (!this.loaded) await this.init();
    this.cache = [];
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.flush();
  }

  async exportData() {
    if (!this.loaded) await this.init();
    return exportPlaylists(this.cache);
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
    if (!this.loaded) await this.init();
    this.cache = playlistsFromBackup(data);
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.flush();
  }

  scheduleSave() {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, DEBOUNCE_MS);
  }

  /** Empuja la caché al servidor; en fallo reintenta con backoff mientras siga sucia. */
  async flush() {
    if (this.saving || !this.dirty) return;
    this.saving = true;
    let ok = false;
    try {
      const res = await fetch('/api/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ version: 2, playlists: this.cache })
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    this.saving = false;

    if (ok) {
      this.dirty = false;
      // La key legacy se descarta en cuanto el servidor confirma la subida,
      // tanto en el primer intento como tras un reintento.
      if (this.pendingLegacyCleanup) {
        this.pendingLegacyCleanup = false;
        if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_KEY);
      }
      return;
    }
    if (!this.retryTimer) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.flush();
      }, RETRY_MS);
    }
  }
}
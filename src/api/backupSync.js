import { effect } from '@preact/signals';
import storage from '../storage/index.js';
import { playlistState } from '../state/playlistState.js';
import { modeState } from '../state/modeState.js';
import { loadLocalPlaylists } from '../state/playlistImports.js';

const BACKUP_INTERVAL_MS = 30 * 60 * 1000;
const DEBOUNCE_MS = 5000;

const isAvailable = () => typeof fetch !== 'undefined' && typeof localStorage !== 'undefined';

const authHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('yt_session_token') : '';
  return token ? { Authorization: token } : {};
};

const exportSnapshot = async () => {
  if (playlistState.playlists.value.length === 0) return null;
  return storage.exportData();
};

/**
 * Envía el respaldo actual (exportData v2) al servidor.
 * Solo fuera de la demo y cuando hay biblioteca: nunca pisa el respaldo del
 * servidor con una lista vacía (LockScreen, bienvenida, primer arranque).
 */
export const pushBackup = async () => {
  if (!isAvailable() || modeState.isDemo.value) return false;
  const json = await exportSnapshot();
  if (!json) return false;
  try {
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: json
    });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Restaura la biblioteca desde el respaldo del servidor (reutiliza
 * importData: los tracks quedan sin verificar y el link checker repuebla
 * miniatura/fecha/duración desde YouTube).
 */
export const restoreFromServer = async () => {
  if (!isAvailable() || modeState.isDemo.value) return false;
  try {
    const res = await fetch('/api/backup', { headers: authHeaders() });
    if (!res.ok) return false;
    const json = await res.text();
    await storage.importData(json);
    await loadLocalPlaylists();
    if (playlistState.playlists.value.length > 0 && !playlistState.activePlaylist.value) {
      playlistState.activePlaylist.value = playlistState.playlists.value[0];
    }
    return true;
  } catch {
    return false;
  }
};

/** Borra el respaldo del servidor (parte del borrado total de datos). */
export const clearServerBackup = async () => {
  if (!isAvailable() || modeState.isDemo.value) return false;
  try {
    const res = await fetch('/api/backup', { method: 'DELETE', headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Restaura automáticamente solo si el almacenamiento local NUNCA se inicializó
 * (navegador limpio / primer uso en otro equipo). Si el usuario borró todo
 * (key `[]`) o ya tiene datos, no se toca su decisión.
 */
export const maybeRestoreFromServer = async () => {
  if (!isAvailable() || modeState.isDemo.value) return false;
  if (localStorage.getItem('yt_player_playlists') !== null) return false;
  return restoreFromServer();
};

// Respaldo ante cualquier cambio de la biblioteca (debounce de 5s).
let pushTimer = null;
const schedulePush = () => {
  if (modeState.isDemo.value) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushBackup();
  }, DEBOUNCE_MS);
};

effect(() => {
  void playlistState.playlists.value;
  schedulePush();
});

// Red de seguridad periódica (30 min) mientras la app esté abierta.
if (isAvailable()) {
  setInterval(() => {
    pushBackup();
  }, BACKUP_INTERVAL_MS);
}
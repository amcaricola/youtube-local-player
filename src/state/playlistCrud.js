import storage from '../storage/index.js';
import { playlistState, showToast } from './playlistState.js';
import { playerState } from './playerState.js';
import { loadLocalPlaylists } from './playlistImports.js';

/**
 * CRUD de playlists y tracks en el storage local (o en memoria en la demo).
 * La importación desde YouTube vive en `playlistImports.js`.
 */

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
 * Crea una playlist local vacía (sin origen en YouTube) y la deja activa.
 * En modo demo se guarda solo en memoria.
 * @param {string} title
 */
export const createLocalPlaylist = async (title) => {
  const now = Date.now();
  const playlist = {
    id: `local_${now}_${Math.random().toString(36).slice(2, 7)}`,
    youtubePlaylistId: null,
    title: title.trim() || 'Nueva playlist',
    description: '',
    thumbnail: '',
    tracks: [],
    createdAt: now,
    updatedAt: now
  };

  await storage.savePlaylist(playlist);
  await loadLocalPlaylists();
  playlistState.activePlaylist.value =
    playlistState.playlists.value.find(p => p.id === playlist.id) || playlist;
  showToast('Playlist local creada');
};

/**
 * Agrega una canción creada manualmente a una playlist local.
 * Rechaza duplicados por videoId y persiste el track (en demo, en memoria).
 * @param {string} playlistId
 * @param {import('../types/player.js').Track} track
 * @returns {Promise<boolean>} true si se agregó, false si ya existía
 */
export const addTrackToPlaylist = async (playlistId, track) => {
  const playlists = await storage.getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return false;
  if (playlist.tracks.some(t => t.videoId === track.videoId)) {
    showToast('Esa canción ya está en la playlist');
    return false;
  }

  const now = Date.now();
  const newTrack = { ...track, addedAt: now };
  const updatedPlaylist = { ...playlist, tracks: [...playlist.tracks, newTrack], updatedAt: now };

  await storage.savePlaylist(updatedPlaylist);

  const applyAdd = (pl) => (pl.id === playlistId ? updatedPlaylist : pl);

  playlistState.playlists.value = playlistState.playlists.value.map(applyAdd);
  if (playlistState.activePlaylist.value?.id === playlistId) {
    playlistState.activePlaylist.value = updatedPlaylist;
  }

  showToast('Canción agregada');
  return true;
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
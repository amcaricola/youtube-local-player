import { fetchPlaylistData } from '../api/youtubeApi.js';
import { parseTrackMetadata } from '../api/metadataParser.js';
import storage from '../storage/index.js';
import { playlistState } from './playlistState.js';
import { settingsState } from './settingsState.js';
import { modeState } from './modeState.js';
import { DEMO_PLAYLIST_ID } from './playlistDemo.js';

/**
 * Carga las playlists desde el storage local.
 * Si aparece la playlist de demo persistida (legado de una versión anterior
 * que sí guardaba la demo en localStorage), se purga: la demo vive solo en
 * memoria y en la ruta /demo, nunca en el almacenamiento del servidor.
 */
export const loadLocalPlaylists = async () => {
  const lists = await storage.getPlaylists();
  let clean = lists;
  if (!modeState.isDemo.value && lists.some(p => p.id === DEMO_PLAYLIST_ID)) {
    await storage.deletePlaylist(DEMO_PLAYLIST_ID);
    clean = lists.filter(p => p.id !== DEMO_PLAYLIST_ID);
  }
  playlistState.playlists.value = clean;
  if (clean.length > 0 && !playlistState.activePlaylist.value) {
    playlistState.activePlaylist.value = clean[0];
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
 * Importa y parsea una playlist desde YouTube a la base de datos local.
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
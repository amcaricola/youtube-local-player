import storage from '../storage/index.js';
import { playlistState, showToast } from './playlistState.js';
import { setMode } from './modeState.js';

export const DEMO_PLAYLIST_ID = 'demo-playlist';

/**
 * Carga la playlist de demostración desde el JSON local (no usa API Key).
 * Los timestamps volátiles (brokenAt, addedAt, etc.) se calculan relativos
 * al momento actual para que los badges se vean frescos.
 * @param {object|null} [demoData] Datos de la demo inyectados (usado en tests;
 *   en el navegador se importa el JSON automáticamente).
 */
export const loadDemoPlaylist = async (demoData = null) => {
  if (!demoData) {
    const mod = await import('../data/demoPlaylist.json');
    demoData = mod.default;
  }
  const now = Date.now();
  const DAY = 86400000;

  const tracks = demoData.tracks.map((t, i) => {
    const isBroken = t.status === 'broken';
    const isUnchecked = t.status === 'unchecked';
    const brokenDaysAgo = t.brokenDaysAgo || 0;
    return {
      id: `demo-track-${i + 1}`,
      videoId: t.videoId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.thumbnailUrl || '',
      publishedAt: isBroken || isUnchecked ? null : t.publishedAt,
      durationSeconds: isBroken || isUnchecked ? null : t.durationSeconds,
      status: t.status,
      statusMessage: t.statusMessage || null,
      brokenAt: isBroken ? now - brokenDaysAgo * DAY : null,
      metadataFetchedAt: isBroken || isUnchecked ? 0 : now - 2 * DAY,
      removedFromSource: Boolean(t.removedFromSource),
      addedAt: now - (brokenDaysAgo + 20) * DAY,
      lastCheckedAt: isUnchecked ? null : isBroken ? now - brokenDaysAgo * DAY : now - DAY
    };
  });

  const playlist = {
    id: DEMO_PLAYLIST_ID,
    youtubePlaylistId: null,
    title: demoData.title,
    description: demoData.description,
    thumbnail: demoData.thumbnail,
    tracks,
    createdAt: now,
    updatedAt: now
  };

  await storage.savePlaylist(playlist);
  const { loadLocalPlaylists } = await import('./playlistImports.js');
  await loadLocalPlaylists();
  playlistState.activePlaylist.value =
    playlistState.playlists.value.find(p => p.id === DEMO_PLAYLIST_ID) || playlist;
  setMode('demo');
  playlistState.showDemoIntro.value = true;
  showToast('Modo demo activado');
};

/**
 * Sale del modo demo: elimina la playlist de ejemplo, vuelve a 'none' y
 * redirige a la raíz (la demo vive en la ruta /demo).
 */
export const exitDemoMode = async () => {
  await storage.deletePlaylist(DEMO_PLAYLIST_ID);
  const { loadLocalPlaylists } = await import('./playlistImports.js');
  await loadLocalPlaylists();
  if (playlistState.activePlaylist.value?.id === DEMO_PLAYLIST_ID) {
    playlistState.activePlaylist.value = null;
  }
  setMode('none');
  if (typeof location !== 'undefined') {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[segments.length - 1] === 'demo') {
      location.href = './';
      return;
    }
  }
  showToast('Saliste del modo demo');
};
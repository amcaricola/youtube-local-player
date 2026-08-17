import test from 'node:test';
import assert from 'node:assert/strict';

// settingsState.js y el storage leen localStorage a nivel módulo, y modeState
// detecta la demo por RUTA: mockeamos ambos ANTES de importar playlistState
// para que el adaptador activo sea el de memoria (escenario real del bug).
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};
globalThis.location = { pathname: '/demo' };

const {
  playlistState,
  createLocalPlaylist,
  addTrackToPlaylist
} = await import('../src/state/playlistState.js');

const makeTrack = () => ({
  id: 'dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Canción',
  artist: 'Artista',
  thumbnailUrl: '',
  publishedAt: null,
  durationSeconds: null,
  status: 'unchecked',
  statusMessage: null,
  brokenAt: null,
  metadataFetchedAt: 0,
  removedFromSource: false,
  addedAt: Date.now(),
  lastCheckedAt: null
});

test('agregar una canción no la duplica en la playlist (modo demo)', async () => {
  await createLocalPlaylist('Mi playlist');
  const plId = playlistState.activePlaylist.value.id;

  const ok = await addTrackToPlaylist(plId, makeTrack());
  assert.equal(ok, true);
  assert.equal(playlistState.activePlaylist.value.tracks.length, 1);
  assert.equal(playlistState.playlists.value.find(p => p.id === plId).tracks.length, 1);

  // El adaptador activo es el de memoria: no debe escribirse nada en localStorage.
  assert.equal(values.has('yt_player_playlists'), false);
});

test('rechaza agregar un videoId duplicado', async () => {
  await createLocalPlaylist('Otra playlist');
  const plId = playlistState.activePlaylist.value.id;

  await addTrackToPlaylist(plId, makeTrack());
  const dup = await addTrackToPlaylist(plId, { ...makeTrack(), title: 'Otra vez' });
  assert.equal(dup, false);
  assert.equal(playlistState.activePlaylist.value.tracks.length, 1);
});

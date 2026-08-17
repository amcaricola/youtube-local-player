import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// settingsState.js y el storage leen localStorage a nivel módulo, y modeState
// detecta la demo por RUTA: mockeamos ambos ANTES de importar playlistState
// para que la demo cargue en el adaptador de memoria (sin tocar localStorage).
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};
globalThis.location = { pathname: '/demo' };

const require = createRequire(import.meta.url);
const demoData = require('../src/data/demoPlaylist.json');

const {
  playlistState,
  filteredTracks,
  problemCounts,
  loadDemoPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  updateTrackMetadata
} = await import('../src/state/playlistState.js');

const DEMO_PLAYLIST_ID = 'demo-playlist';
const NEW_VIDEO_ID = 'NEW_VIDEO_ID_01';

const makeTrack = (videoId = NEW_VIDEO_ID) => ({
  id: videoId,
  videoId,
  title: 'Canción nueva',
  artist: 'Artista nuevo',
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

test('loadDemoPlaylist carga la playlist de demo con sus 11 tracks', async () => {
  await loadDemoPlaylist(demoData);
  const pl = playlistState.activePlaylist.value;

  assert.equal(pl.id, DEMO_PLAYLIST_ID);
  assert.equal(pl.tracks.length, 11);
  assert.equal(playlistState.playlists.value.length, 1);
  assert.equal(pl.tracks[0].videoId, 'dQw4w9WgXcQ');
  assert.equal(pl.tracks[7].status, 'warning');   // CevxZvSJLk8 (Video privado)
  assert.equal(pl.tracks[8].status, 'broken');    // demo-broken-001 (Video eliminado)
  assert.equal(pl.tracks[9].status, 'unchecked'); // e-ORhEE9VVg
  assert.equal(pl.tracks[10].removedFromSource, true); // OPf0YbXqDm0

  // Modo demo = adaptador de memoria: no se escribe nada en localStorage.
  assert.equal(values.has('yt_player_playlists'), false);
});

test('agregar una canción nueva la anexa al final (12 tracks)', async () => {
  const ok = await addTrackToPlaylist(DEMO_PLAYLIST_ID, makeTrack());
  assert.equal(ok, true);

  const pl = playlistState.activePlaylist.value;
  assert.equal(pl.tracks.length, 12);
  const last = pl.tracks[11];
  assert.equal(last.videoId, NEW_VIDEO_ID);
  assert.equal(last.status, 'unchecked');
  assert.equal(playlistState.playlists.value[0].tracks.length, 12);
});

test('rechaza agregar un videoId que ya está en la demo', async () => {
  const dup = await addTrackToPlaylist(DEMO_PLAYLIST_ID, makeTrack('dQw4w9WgXcQ'));
  assert.equal(dup, false);
  assert.equal(playlistState.activePlaylist.value.tracks.length, 12);
});

test('removeTrackFromPlaylist elimina el track agregado', async () => {
  await removeTrackFromPlaylist(DEMO_PLAYLIST_ID, NEW_VIDEO_ID);
  const pl = playlistState.activePlaylist.value;
  assert.equal(pl.tracks.length, 11);
  assert.equal(pl.tracks.some(t => t.videoId === NEW_VIDEO_ID), false);
});

test('updateTrackMetadata edita un track de la demo sin pisar el resto', async () => {
  const first = playlistState.activePlaylist.value.tracks[0];
  const firstId = first.id;

  await updateTrackMetadata(DEMO_PLAYLIST_ID, firstId, { title: 'Título editado' });

  const updated = playlistState.activePlaylist.value.tracks[0];
  assert.equal(updated.title, 'Título editado');
  assert.equal(updated.artist, 'Rick Astley'); // no se tocó
  assert.equal(playlistState.playlists.value[0].tracks[0].title, 'Título editado');
  assert.equal(playlistState.activePlaylist.value.tracks[1].videoId, '9bZkp7q19f0'); // resto intacto
});

test('filtro de problemas y contadores usan los estados de la demo', () => {
  assert.deepEqual(problemCounts.value, { broken: 1, warning: 1 });

  playlistState.problemFilter.value = true;
  assert.equal(filteredTracks.value.length, 2);
  assert.ok(filteredTracks.value.every(t => t.status === 'broken' || t.status === 'warning'));
  playlistState.problemFilter.value = false;
});

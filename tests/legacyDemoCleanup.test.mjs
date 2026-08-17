import test from 'node:test';
import assert from 'node:assert/strict';

// settingsState.js lee localStorage a nivel módulo: mockear antes de importar.
// Sin location (no-demo): el adaptador activo es el de localStorage.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const { playlistState } = await import('../src/state/playlistState.js');
const { loadLocalPlaylists } = await import('../src/state/playlistImports.js');
const { DEMO_PLAYLIST_ID } = await import('../src/state/playlistDemo.js');

const demoPlaylist = {
  id: DEMO_PLAYLIST_ID,
  youtubePlaylistId: null,
  title: 'Demo: Mezcla para Explorar',
  description: '',
  thumbnail: '',
  createdAt: 1,
  updatedAt: 1,
  tracks: [{ id: 'demo-track-1', videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', status: 'healthy', addedAt: 1 }]
};

const normalPlaylist = {
  id: 'pl_normal',
  youtubePlaylistId: null,
  title: 'Mi playlist',
  description: '',
  thumbnail: '',
  createdAt: 2,
  updatedAt: 2,
  tracks: []
};

test('purgar legado: la demo persistida no contamina la versión servidor', async () => {
  values.set('yt_player_playlists', JSON.stringify([demoPlaylist, normalPlaylist]));

  await loadLocalPlaylists();

  const ids = playlistState.playlists.value.map(p => p.id);
  assert.ok(!ids.includes(DEMO_PLAYLIST_ID));
  assert.ok(ids.includes('pl_normal'));

  // El barrido también se persiste: la próxima carga no reaparce la demo.
  const stored = JSON.parse(values.get('yt_player_playlists') || '[]');
  assert.ok(!stored.some(p => p.id === DEMO_PLAYLIST_ID));
  assert.equal(stored.length, 1);
});

test('sin datos legacy la carga normal no cambia nada', async () => {
  values.set('yt_player_playlists', JSON.stringify([normalPlaylist]));
  playlistState.activePlaylist.value = null;

  await loadLocalPlaylists();

  assert.deepEqual(playlistState.playlists.value.map(p => p.id), ['pl_normal']);
  assert.equal(playlistState.activePlaylist.value.id, 'pl_normal');
});
import test from 'node:test';
import assert from 'node:assert/strict';

// El modo local ya no existe: la biblioteca siempre vive en el servidor
// (/api/library). Este test simula ese servidor con un almacén en memoria
// para verificar que la playlist de demo persistida (legado de una versión
// anterior) se purga y no contamina la biblioteca real.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

let serverLibrary = [];
globalThis.fetch = async (path, options = {}) => {
  if (path === '/api/library' && (!options.method || options.method === 'GET')) {
    return new Response(JSON.stringify({ version: 2, playlists: serverLibrary }), { status: 200 });
  }
  if (path === '/api/library' && options.method === 'PUT') {
    serverLibrary = (JSON.parse(options.body || '{}').playlists) || [];
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
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

const waitForFlush = () => new Promise(resolve => setTimeout(resolve, 400));

test('purgar legado: la demo persistida no contamina la biblioteca del servidor', async () => {
  serverLibrary = [demoPlaylist, normalPlaylist];

  await loadLocalPlaylists();

  const ids = playlistState.playlists.value.map(p => p.id);
  assert.ok(!ids.includes(DEMO_PLAYLIST_ID));
  assert.ok(ids.includes('pl_normal'));

  // El borrado también llega al servidor (flush debounced).
  await waitForFlush();
  assert.ok(!serverLibrary.some(p => p.id === DEMO_PLAYLIST_ID));
  assert.equal(serverLibrary.length, 1);
});

test('sin datos legacy la carga normal no cambia nada', async () => {
  serverLibrary = [normalPlaylist];
  playlistState.activePlaylist.value = null;

  await loadLocalPlaylists();

  assert.deepEqual(playlistState.playlists.value.map(p => p.id), ['pl_normal']);
  assert.equal(playlistState.activePlaylist.value.id, 'pl_normal');
});
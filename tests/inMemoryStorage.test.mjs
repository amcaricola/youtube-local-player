import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStorageAdapter } from '../src/storage/InMemoryStorageAdapter.js';

const playlist = {
  id: 'demo-playlist',
  youtubePlaylistId: null,
  title: 'Demo',
  description: '',
  thumbnail: '',
  tracks: [{ id: 't1', videoId: 'abc', title: 'Cancion', artist: 'Artista', status: 'healthy' }],
  createdAt: 1,
  updatedAt: 1
};

test('in-memory adapter guarda, actualiza y lee sin tocar localStorage', async () => {
  const storage = new InMemoryStorageAdapter();
  await storage.savePlaylist(playlist);

  assert.equal(await storage.getPlaylists().then(pls => pls.length), 1);
  assert.equal(typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage.getItem('yt_player_playlists'), null);

  await storage.updateTrack('demo-playlist', 't1', { title: 'Editada' });
  const [pl] = await storage.getPlaylists();
  assert.equal(pl.tracks[0].title, 'Editada');
});

test('in-memory adapter: deletePlaylist y clearAll vacían la memoria', async () => {
  const storage = new InMemoryStorageAdapter();
  await storage.savePlaylist(playlist);
  await storage.savePlaylist({ id: 'otra', title: 'Otra', tracks: [] });

  await storage.deletePlaylist('demo-playlist');
  assert.equal(await storage.getPlaylists().then(pls => pls.length), 1);

  await storage.clearAll();
  assert.deepEqual(await storage.getPlaylists(), []);
});

test('in-memory adapter exporta e importa el esquema mínimo de respaldo', async () => {
  const storage = new InMemoryStorageAdapter();
  await storage.savePlaylist(playlist);

  const backup = JSON.parse(await storage.exportData());
  assert.equal(backup.version, 2);
  assert.deepEqual(Object.keys(backup.playlists[0].tracks[0]).sort(),
    ['addedAt', 'artist', 'playableVideoId', 'removedFromSource', 'title', 'videoId']);

  const restored = new InMemoryStorageAdapter();
  await restored.importData(JSON.stringify(backup));
  const [pl] = await restored.getPlaylists();
  assert.equal(pl.id, 'demo-playlist');
  assert.equal(pl.tracks[0].status, 'unchecked');
});
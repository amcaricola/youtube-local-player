import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAdapter } from '../src/storage/LocalStorageAdapter.js';

const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
};

test('playlist backup restores saved metadata through the storage adapter', async () => {
  globalThis.localStorage = createMemoryStorage();
  const storage = new LocalStorageAdapter();
  const playlist = {
    id: 'backup-playlist',
    title: 'Mi playlist',
    tracks: [{ id: 'backup-track', title: 'Cancion original', artist: 'Artista', videoId: 'video' }]
  };

  await storage.savePlaylist(playlist);
  await storage.updateTrack('backup-playlist', 'backup-track', { title: 'Cancion editada' });
  const backup = await storage.exportData();

  await storage.importData(JSON.stringify({ playlists: [] }));
  assert.deepEqual(await storage.getPlaylists(), []);

  await storage.importData(backup);
  const restored = await storage.getPlaylists();
  assert.equal(restored[0].title, 'Mi playlist');
  assert.equal(restored[0].tracks[0].title, 'Cancion editada');
});

test('invalid playlist backup is rejected without replacing valid data', async () => {
  globalThis.localStorage = createMemoryStorage();
  const storage = new LocalStorageAdapter();
  const playlist = { id: 'valid-playlist', title: 'Valida', tracks: [] };
  await storage.savePlaylist(playlist);

  await assert.rejects(() => storage.importData('{"invalid":true}'), /Failed to parse backup data/);
  assert.deepEqual(await storage.getPlaylists(), [playlist]);
});

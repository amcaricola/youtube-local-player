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

test('export uses the minimal user-library schema (no YouTube API data)', async () => {
  globalThis.localStorage = createMemoryStorage();
  const storage = new LocalStorageAdapter();
  await storage.savePlaylist({
    id: 'pl1',
    title: 'Mix',
    tracks: [{
      id: 'v1',
      videoId: 'v1',
      title: 'Canción',
      artist: 'Artista',
      thumbnailUrl: 'https://i.ytimg.com/vi/v1/default.jpg',
      publishedAt: '2021-05-05T00:00:00Z',
      durationSeconds: 200,
      status: 'healthy',
      lastCheckedAt: 123
    }]
  });

  const backup = JSON.parse(await storage.exportData());
  assert.equal(backup.version, 2);
  const track = backup.playlists[0].tracks[0];
  assert.deepEqual(Object.keys(track).sort(), ['addedAt', 'artist', 'removedFromSource', 'title', 'videoId']);
  assert.equal(track.publishedAt, undefined);
  assert.equal(track.thumbnailUrl, undefined);
});

test('import marks tracks unchecked so the sweep repopulates API metadata', async () => {
  globalThis.localStorage = createMemoryStorage();
  const storage = new LocalStorageAdapter();
  await storage.importData(JSON.stringify({
    version: 2,
    playlists: [{
      id: 'pl1',
      title: 'Mix',
      tracks: [{ videoId: 'v1', title: 'Canción', artist: 'Artista' }]
    }]
  }));

  const [restored] = await storage.getPlaylists();
  const track = restored.tracks[0];
  assert.equal(track.status, 'unchecked');
  assert.equal(track.metadataFetchedAt, 0);
  assert.equal(track.lastCheckedAt, null);
  assert.equal(track.publishedAt, null);
});

test('legacy tracks are migrated on load: originalTitle/channelTitle stripped', async () => {
  globalThis.localStorage = createMemoryStorage();
  const storage = new LocalStorageAdapter();
  await storage.savePlaylist({
    id: 'pl1',
    title: 'Vieja',
    tracks: [{
      id: 'v1',
      videoId: 'v1',
      title: 'Canción',
      artist: 'Artista',
      originalTitle: 'Artista - Canción (Official Video)',
      channelTitle: 'ArtistaVEVO',
      status: 'healthy',
      addedAt: 111
    }]
  });

  const [migrated] = await storage.getPlaylists();
  const track = migrated.tracks[0];
  assert.equal(track.originalTitle, undefined);
  assert.equal(track.channelTitle, undefined);
  assert.equal(track.title, 'Canción');
  assert.equal(track.artist, 'Artista');
  assert.ok(track.metadataFetchedAt > 0);

  // La migración también debe quedar persistida en el storage crudo
  const raw = JSON.parse(globalThis.localStorage.getItem('yt_player_playlists'));
  assert.equal(raw[0].tracks[0].originalTitle, undefined);
  assert.equal(raw[0].tracks[0].channelTitle, undefined);
});

test('clearAll wipes every playlist', async () => {
  globalThis.localStorage = createMemoryStorage();
  const storage = new LocalStorageAdapter();
  await storage.savePlaylist({ id: 'pl1', title: 'Mix', tracks: [] });
  await storage.clearAll();
  assert.deepEqual(await storage.getPlaylists(), []);
});

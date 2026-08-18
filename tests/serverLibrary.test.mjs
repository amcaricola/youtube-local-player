import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Configuración aislada: .config.json y library.json en tmp.
const tmp = await mkdtemp(join(tmpdir(), 'yt-server-library-'));
process.env.YT_CONFIG_PATH = join(tmp, 'config.json');
process.env.YT_LIBRARY_PATH = join(tmp, 'library.json');
process.env.YT_SESSIONS_PATH = join(tmp, 'sessions.json');

const { createApp } = await import('../server/app.js');
const app = createApp();

test.after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const libraryData = JSON.stringify({
  version: 2,
  playlists: [{
    id: 'pl-test',
    youtubePlaylistId: null,
    title: 'Playlist de prueba',
    createdAt: Date.now(),
    tracks: [
      { id: 't-1', videoId: 'abc123', title: 'Canción', artist: 'Artista', status: 'healthy', addedAt: Date.now(), metadataFetchedAt: Date.now() }
    ]
  }]
});

const put = (body, token) => app.request('/api/library', {
  method: 'PUT',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
  body
});

const get = (token) => app.request('/api/library', {
  headers: token ? { authorization: token } : {}
});

const del = (token) => app.request('/api/library', {
  method: 'DELETE',
  headers: token ? { authorization: token } : {}
});

const makeToken = async () => {
  const res = await app.request('/api/auth/unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'clave' })
  });
  const { token } = await res.json();
  return token;
};

// --- Tests sin contraseña configurada ---

test('GET: biblioteca vacía devuelve { playlists: [] }', async () => {
  const res = await get();
  assert.equal(res.status, 200);
  const json = JSON.parse(await res.text());
  assert.deepEqual(json, { version: 2, playlists: [] });
});

test('PUT+GET: round-trip de la biblioteca', async () => {
  const putRes = await put(libraryData);
  assert.equal(putRes.status, 200);
  assert.deepEqual(await putRes.json(), { ok: true });

  const res = await get();
  const json = JSON.parse(await res.text());
  assert.equal(json.version, 2);
  assert.equal(json.playlists[0].title, 'Playlist de prueba');
  assert.equal(json.playlists[0].tracks[0].videoId, 'abc123');
});

test('el documento guardado no contiene configuración del super usuario', async () => {
  const raw = await readFile(process.env.YT_LIBRARY_PATH, 'utf8');
  for (const key of ['yt_api_key', 'yt_auto_check', 'yt_auto_sync', 'yt_demo_enabled', 'masterPassword', 'authSecret', 'noAuthentication']) {
    assert.ok(!raw.includes(key), `no debe contener ${key}`);
  }
});

test('PUT: cuerpo sin playlists o JSON inválido se rechaza', async () => {
  const bad1 = await put('{"foo":1}');
  assert.equal(bad1.status, 400);

  const bad2 = await put('no-json');
  assert.equal(bad2.status, 400);

  const bad3 = await put('');
  assert.equal(bad3.status, 400);
});

test('DELETE: borra la biblioteca del servidor', async () => {
  await put(libraryData);
  const res = await del();
  assert.equal(res.status, 200);

  const after = await get();
  const json = JSON.parse(await after.text());
  assert.deepEqual(json, { version: 2, playlists: [] });
});

test('POST: alias de PUT (sendBeacon) funciona', async () => {
  const res = await app.request('/api/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: libraryData
  });
  assert.equal(res.status, 200);
  const json = JSON.parse(await (await get()).text());
  assert.equal(json.playlists[0].title, 'Playlist de prueba');
});

// --- Tests con contraseña configurada ---

test('PUT/GET/DELETE: con contraseña exigen token de sesión', async () => {
  await app.request('/api/auth/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'clave' })
  });

  assert.equal((await put(libraryData)).status, 401);
  assert.equal((await get()).status, 401);
  assert.equal((await del()).status, 401);

  const token = await makeToken();
  assert.equal((await put(libraryData, token)).status, 200);
  assert.equal((await get(token)).status, 200);
  assert.equal((await del(token)).status, 200);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Configuración aislada: .config.json y carpeta de backups en tmp.
const tmp = await mkdtemp(join(tmpdir(), 'yt-server-backup-'));
process.env.YT_CONFIG_PATH = join(tmp, 'config.json');
process.env.YT_BACKUP_DIR = join(tmp, 'backups');

const { createApp } = await import('../server/app.js');
const app = createApp();

test.after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const backupData = JSON.stringify({
  version: 2,
  exportedAt: new Date().toISOString(),
  playlists: [{
    id: 'pl-test',
    title: 'Playlist de prueba',
    youtubePlaylistId: null,
    createdAt: Date.now(),
    tracks: [
      { videoId: 'abc123', title: 'Canción', artist: 'Artista', addedAt: Date.now(), removedFromSource: false }
    ]
  }]
});

const postBackup = (body, token) => app.request('/api/backup', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
  body
});

const getBackup = (token) => app.request('/api/backup', {
  headers: token ? { authorization: token } : {}
});

const deleteBackup = (token) => app.request('/api/backup', {
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

test('POST: guarda el backup en el servidor (sin auth)', async () => {
  const res = await postBackup(backupData);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('GET: devuelve el backup guardado', async () => {
  const res = await getBackup();
  assert.equal(res.status, 200);
  const json = JSON.parse(await res.text());
  assert.equal(json.version, 2);
  assert.equal(json.playlists[0].title, 'Playlist de prueba');
});

test('el backup no contiene configuración del super usuario', async () => {
  const res = await getBackup();
  const raw = await res.text();
  for (const key of ['yt_api_key', 'yt_auto_check', 'yt_auto_sync', 'yt_demo_enabled', 'masterPassword', 'authSecret', 'noAuthentication']) {
    assert.ok(!raw.includes(key), `no debe contener ${key}`);
  }
});

test('rotación: solo conserva 3 copias', async () => {
  for (let i = 1; i <= 5; i++) {
    const r = await postBackup(JSON.stringify({ version: 2, playlists: [], i }));
    assert.equal(r.status, 200);
  }
  const files = await readdir(process.env.YT_BACKUP_DIR);
  assert.ok(files.length <= 3, `debe haber ≤3 copias, hay ${files.length}`);

  const res = await getBackup();
  const json = JSON.parse(await res.text());
  assert.equal(json.i, 5, 'el GET devuelve el más reciente');
});

test('DELETE: borra todos los respaldos', async () => {
  const res = await deleteBackup();
  assert.equal(res.status, 200);

  const get = await getBackup();
  assert.equal(get.status, 404);
});

// --- Tests con contraseña configurada ---

test('POST/GET: con contraseña exige token de sesión', async () => {
  // Fijar contraseña
  await app.request('/api/auth/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'clave' })
  });

  // Sin token → 401
  const noAuth = await postBackup(backupData);
  assert.equal(noAuth.status, 401);

  const getNoAuth = await getBackup();
  assert.equal(getNoAuth.status, 401);

  // Con token → 200
  const token = await makeToken();
  const withAuth = await postBackup(backupData, token);
  assert.equal(withAuth.status, 200);

  const getWithAuth = await getBackup(token);
  assert.equal(getWithAuth.status, 200);
});

test('DELETE: con contraseña exige token', async () => {
  const noAuth = await deleteBackup();
  assert.equal(noAuth.status, 401);

  const token = await makeToken();
  const withAuth = await deleteBackup(token);
  assert.equal(withAuth.status, 200);
});

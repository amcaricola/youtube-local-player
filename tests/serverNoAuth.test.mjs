import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Modo recuperación (estilo Trilium): noAuthentication=true en .config.json
// desactiva el acceso para poder restablecer la contraseña maestra sin sesión.
// Al fijar una contraseña el servidor reactiva la autenticación (noAuthentication:false).
const tmp = await mkdtemp(join(tmpdir(), 'yt-noauth-'));
process.env.YT_CONFIG_PATH = join(tmp, 'config.json');
process.env.YT_SESSIONS_PATH = join(tmp, 'sessions.json');
await writeFile(process.env.YT_CONFIG_PATH, JSON.stringify({ noAuthentication: true }));

const { createApp } = await import('../server/app.js');
const app = createApp();

test.after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const post = (path, body, token) => app.request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
  body: JSON.stringify(body)
});

test('status reporta autenticación desactivada (instancia pública)', async () => {
  const res = await app.request('/api/auth/status');
  const data = await res.json();
  assert.equal(data.noAuthentication, true);
  assert.equal(data.passwordSet, false);
});

test('se puede fijar la contraseña sin sesión y reactiva la autenticación', async () => {
  const set = await post('/api/auth/password', { password: 'nueva-clave' });
  const data = await set.json();
  assert.equal(data.ok, true);
  assert.ok(data.token);

  const status = await app.request('/api/auth/status');
  const statusData = await status.json();
  assert.equal(statusData.passwordSet, true);
  assert.equal(statusData.noAuthentication, false);
});

test('al reactivarse, el unlock exige la contraseña correcta', async () => {
  const wrong = await post('/api/auth/unlock', { password: 'cualquier-cosa' });
  assert.equal(wrong.status, 401);

  const right = await post('/api/auth/unlock', { password: 'nueva-clave' });
  const data = await right.json();
  assert.equal(data.ok, true);
  assert.ok(data.token);
});

test('se puede eliminar la contraseña con sesión; deja la instancia pública', async () => {
  const lock = await post('/api/auth/unlock', { password: 'nueva-clave' });
  const { token } = await lock.json();

  const noSession = await post('/api/auth/password', { password: '' });
  assert.equal(noSession.status, 401);

  const del = await post('/api/auth/password', { password: '' }, token);
  assert.equal((await del.json()).ok, true);

  const status = await app.request('/api/auth/status');
  assert.deepEqual(await status.json(), { passwordSet: false, noAuthentication: true, demoEnabled: true });
});
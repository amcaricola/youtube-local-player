import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Modo recuperación (estilo Trilium): noAuthentication=true en .config.json
// desactiva el acceso para poder restablecer la contraseña maestra sin sesión.
const tmp = await mkdtemp(join(tmpdir(), 'yt-noauth-'));
process.env.YT_CONFIG_PATH = join(tmp, 'config.json');
await writeFile(process.env.YT_CONFIG_PATH, JSON.stringify({ noAuthentication: true }));

const { createApp } = await import('../server/app.js');
const app = createApp();

test.after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const post = (path, body) => app.request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

test('status reporta autenticación desactivada', async () => {
  const res = await app.request('/api/auth/status');
  const data = await res.json();
  assert.equal(data.noAuthentication, true);
  assert.equal(data.passwordSet, false);
});

test('se puede fijar la contraseña sin sesión (reset de acceso)', async () => {
  const set = await post('/api/auth/password', { password: 'nueva-clave' });
  assert.equal((await set.json()).ok, true);

  const status = await app.request('/api/auth/status');
  assert.equal((await status.json()).passwordSet, true);
});

test('unlock queda abierto aunque la contraseña exista (bypass)', async () => {
  const wrong = await post('/api/auth/unlock', { password: 'cualquier-cosa' });
  const data = await wrong.json();
  assert.equal(data.ok, true);
  assert.ok(data.token);
});

test('se puede eliminar la contraseña sin sesión', async () => {
  const del = await post('/api/auth/password', { password: '' });
  assert.equal((await del.json()).ok, true);
  const status = await app.request('/api/auth/status');
  assert.equal((await status.json()).passwordSet, false);
});
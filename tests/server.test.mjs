import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

// Configuración aislada: los tests usan un .config.json temporal en vez de server/.config.json.
const tmp = await mkdtemp(join(tmpdir(), 'yt-server-'));
process.env.YT_CONFIG_PATH = join(tmp, 'config.json');
process.env.YT_SESSIONS_PATH = join(tmp, 'sessions.json');

const { createApp } = await import('../server/app.js');
const { createSessionToken, verifyToken, hashPassword, verifyPassword } = await import('../server/auth.js');
const { getOrCreateSecret } = await import('../server/config.js');

const app = createApp();

test.after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const post = (path, body, token) => app.request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
  body: JSON.stringify(body)
});

test('sin contraseña configurada el status lo reporta y el unlock abre sesión', async () => {
  const status = await app.request('/api/auth/status');
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { passwordSet: false, noAuthentication: false, demoEnabled: true });

  const unlock = await post('/api/auth/unlock', { password: 'cualquiera' });
  const data = await unlock.json();
  assert.equal(data.ok, true);
  assert.ok(data.token);
  assert.ok(verifyToken(data.token));
});

test('definir la contraseña maestra y validarla en unlock', async () => {
  const set = await post('/api/auth/password', { password: 'super-secreto' });
  const setData = await set.json();
  assert.equal(setData.ok, true);
  // Al fijar la contraseña se entrega una sesión nueva (no bloquearse a sí mismo).
  assert.ok(setData.token && verifyToken(setData.token));

  const status = await app.request('/api/auth/status');
  assert.equal((await status.json()).passwordSet, true);

  const wrong = await post('/api/auth/unlock', { password: 'incorrecta' });
  assert.equal(wrong.status, 401);

  const right = await post('/api/auth/unlock', { password: 'super-secreto' });
  const data = await right.json();
  assert.equal(data.ok, true);
  assert.ok(verifyToken(data.token));
});

test('cambiar la contraseña exige sesión; la contraseña vieja deja de servir', async () => {
  const lock = await post('/api/auth/unlock', { password: 'super-secreto' });
  const { token } = await lock.json();

  const noSession = await post('/api/auth/password', { password: 'otra-secreta' });
  assert.equal(noSession.status, 401);

  const change = await post('/api/auth/password', { password: 'otra-secreta' }, token);
  assert.equal((await change.json()).ok, true);

  const oldPw = await post('/api/auth/unlock', { password: 'super-secreto' });
  assert.equal(oldPw.status, 401);

  const newPw = await post('/api/auth/unlock', { password: 'otra-secreta' });
  assert.equal((await newPw.json()).ok, true);
});

test('verify y revocación de sesión (Bloquear ahora)', async () => {
  const lock = await post('/api/auth/unlock', { password: 'otra-secreta' });
  const { token } = await lock.json();

  const noToken = await app.request('/api/auth/verify');
  assert.equal(noToken.status, 401);

  const withToken = await app.request('/api/auth/verify', { headers: { authorization: token } });
  assert.equal(withToken.status, 200);
  assert.equal((await withToken.json()).ok, true);

  // "Bloquear ahora" revoca la sesión en el servidor: el token deja de servir.
  const lk = await post('/api/auth/lock', {}, token);
  assert.equal((await lk.json()).ok, true);
  const after = await app.request('/api/auth/verify', { headers: { authorization: token } });
  assert.equal(after.status, 401);
});

test('cambiar la contraseña revoca las sesiones previas', async () => {
  const lock = await post('/api/auth/unlock', { password: 'otra-secreta' });
  const { token } = await lock.json();

  const change = await post('/api/auth/password', { password: 'tercera' }, token);
  const changeData = await change.json();
  assert.equal(changeData.ok, true);

  // La sesión vieja queda revocada; la nueva sesión entregada es válida.
  const oldAfter = await app.request('/api/auth/verify', { headers: { authorization: token } });
  assert.equal(oldAfter.status, 401);
  const newAfter = await app.request('/api/auth/verify', { headers: { authorization: changeData.token } });
  assert.equal(newAfter.status, 200);
});

test('eliminar la contraseña marca noAuthentication (instancia abierta)', async () => {
  const lock = await post('/api/auth/unlock', { password: 'tercera' });
  const { token } = await lock.json();

  const del = await post('/api/auth/password', { password: '' }, token);
  assert.equal((await del.json()).ok, true);

  const status = await app.request('/api/auth/status');
  assert.deepEqual(await status.json(), { passwordSet: false, noAuthentication: true, demoEnabled: true });

  // Una vez eliminada, la instancia queda abierta: unlock sin contraseña sirve.
  const open = await post('/api/auth/unlock', { password: 'nada' });
  assert.equal((await open.json()).ok, true);
});

test('POST /settings exige sesión activa si hay contraseña', async () => {
  const set = await post('/api/auth/password', { password: 'clave-settings' });
  const { token } = await set.json();

  const noSession = await post('/api/auth/settings', { demoEnabled: false });
  assert.equal(noSession.status, 401);

  const withSession = await post('/api/auth/settings', { demoEnabled: false }, token);
  assert.equal((await withSession.json()).ok, true);
  const status = await app.request('/api/auth/status');
  assert.equal((await status.json()).demoEnabled, false);

  // Limpiar: restaurar la demo y quitar la contraseña (estado abierto).
  await post('/api/auth/settings', { demoEnabled: true }, token);
  const del = await post('/api/auth/password', { password: '' }, token);
  assert.equal((await del.json()).ok, true);
});

test('POST /settings cambia demoEnabled (decisión del super usuario en la instancia)', async () => {
  // Sin contraseña configurada se puede cambiar libremente.
  const off = await post('/api/auth/settings', { demoEnabled: false });
  assert.equal((await off.json()).ok, true);
  const offStatus = await app.request('/api/auth/status');
  assert.equal((await offStatus.json()).demoEnabled, false);

  // El unlock también lo reporta.
  const unlock = await post('/api/auth/unlock', { password: 'nada' });
  assert.equal((await unlock.json()).demoEnabled, false);

  // Restaurar para no afectar al resto de tests.
  const on = await post('/api/auth/settings', { demoEnabled: true });
  assert.equal((await on.json()).ok, true);
  const onStatus = await app.request('/api/auth/status');
  assert.equal((await onStatus.json()).demoEnabled, true);
});

test('las rutas /api/* no caen en el fallback SPA', async () => {
  const res = await app.request('/api/no-existe');
  assert.equal(res.status, 404);
  assert.notEqual(res.headers.get('content-type'), 'text/html');
});

test('tokens: hash/verify de contraseña y expiración de sesión', async () => {
  const hash = hashPassword('clave');
  assert.notEqual(hash, 'clave');
  assert.equal(verifyPassword('clave', hash), true);
  assert.equal(verifyPassword('otra', hash), false);
  assert.equal(verifyPassword('clave', 'basura'), false);

  // Token firmado correctamente pero vencido: debe ser rechazado.
  const b64url = (buf) => Buffer.from(buf).toString('base64url');
  const expiredBody = b64url(Buffer.from(JSON.stringify({ exp: Date.now() - 1000 })));
  const expiredSig = createHmac('sha256', getOrCreateSecret()).update(expiredBody).digest('base64url');
  assert.equal(verifyToken(`${expiredBody}.${expiredSig}`), null);

  // Token firmado con exp futura: válido.
  const futureBody = b64url(Buffer.from(JSON.stringify({ exp: Date.now() + 60000 })));
  const futureSig = createHmac('sha256', getOrCreateSecret()).update(futureBody).digest('base64url');
  assert.ok(verifyToken(`${futureBody}.${futureSig}`));

  // Token alterado: rechazado.
  const { token } = createSessionToken();
  assert.equal(verifyToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')), null);
});
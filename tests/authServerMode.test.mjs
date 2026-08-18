import test from 'node:test';
import assert from 'node:assert/strict';

// authState en modo servidor: la contraseña maestra se valida contra el
// servidor y la sesión es un token firmado (30 días), no localStorage.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

// Simular un servidor Hono real: status → hay contraseña; unlock valida.
const makeToken = () =>
  Buffer.from(JSON.stringify({ exp: Date.now() + 86400000000 })).toString('base64url') + '.sig';

let sessionRevoked = false;

globalThis.fetch = async (path, options = {}) => {
  if (path === '/api/auth/status') {
    return new Response(JSON.stringify({ passwordSet: true }), { status: 200 });
  }
  if (path === '/api/auth/verify') {
    const hasAuth = !!(options.headers || {}).Authorization;
    if (hasAuth && !sessionRevoked) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }
  if (path === '/api/auth/unlock') {
    const { password } = JSON.parse(options.body || '{}');
    if (password === 'clave') return new Response(JSON.stringify({ ok: true, token: makeToken() }), { status: 200 });
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }
  if (path === '/api/auth/password' || path === '/api/auth/lock') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};

// app_mode = 'servidor' antes de importar: authState arranca en modo servidor.
values.set('app_mode', 'servidor');

const { authState, initAuth, unlockWithPassword, setMasterPassword, lockNow, hasValidSession, reverify } =
  await import(`../src/state/authState.js?server=${Date.now()}`);
const { setMode } = await import('../src/state/modeState.js');

test('arranque en servidor: no está lista hasta consultar el status', () => {
  assert.equal(authState.ready.value, false);
});

test('initAuth consulta el servidor: hay contraseña y sin token → bloqueado', async () => {
  await initAuth();
  assert.equal(authState.ready.value, true);
  assert.equal(authState.passwordRequired.value, true);
  assert.equal(authState.isLocked.value, true);
  assert.equal(hasValidSession(), false);
});

test('unlock con contraseña incorrecta no desbloquea ni guarda token', async () => {
  const ok = await unlockWithPassword('incorrecta');
  assert.equal(ok, false);
  assert.equal(authState.isLocked.value, true);
  assert.equal(values.has('yt_session_token'), false);
});

test('unlock con la contraseña correcta guarda el token y abre sesión', async () => {
  const ok = await unlockWithPassword('clave');
  assert.equal(ok, true);
  assert.equal(authState.isLocked.value, false);
  assert.ok(values.get('yt_session_token'));
  assert.equal(hasValidSession(), true);
});

test('lockNow descarta la sesión en el servidor', async () => {
  lockNow();
  assert.equal(authState.isLocked.value, true);
  assert.equal(values.has('yt_session_token'), false);
  assert.equal(hasValidSession(), false);
});

test('la bienvenida (navegador privado) queda bloqueada si el servidor tiene contraseña', async () => {
  authState.ready.value = false; // simular carga inicial pendiente
  setMode('none'); // navegador privado: sin app_mode → bienvenida
  await initAuth(); // la raíz SIEMPRE consulta el servidor
  assert.equal(authState.ready.value, true);
  assert.equal(authState.passwordRequired.value, true);
  assert.equal(authState.isLocked.value, true);
});

test('setMasterPassword delega al servidor y abre sesión', async () => {
  const ok = await setMasterPassword('nueva');
  assert.equal(ok, true);
  assert.equal(authState.passwordRequired.value, true);
  assert.equal(authState.isLocked.value, false);
});

test('reverify confirma la sesión con el servidor y re-bloquea si se revoca', async () => {
  await unlockWithPassword('clave');
  assert.equal(authState.isLocked.value, false);

  // Sesión activa: el servidor responde OK y la instancia sigue desbloqueada.
  await reverify();
  assert.equal(authState.isLocked.value, false);

  // Sesión revocada en el servidor (401 en /verify): vuelve el bloqueo.
  sessionRevoked = true;
  await reverify();
  assert.equal(authState.isLocked.value, true);
});
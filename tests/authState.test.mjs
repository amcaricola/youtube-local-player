import test from 'node:test';
import assert from 'node:assert/strict';

// authState en modo solo-servidor (el modo local ya no existe): la contraseña
// maestra se valida contra el servidor y la sesión es un token firmado (30
// días). Si el servidor está inalcanzable, la app no puede funcionar.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const makeToken = () =>
  Buffer.from(JSON.stringify({ exp: Date.now() + 86400000000 })).toString('base64url') + '.sig';

let serverDown = false;
let verifyOk = true;

globalThis.fetch = async (path, options = {}) => {
  if (serverDown) throw new Error('network');
  const body = options.body ? JSON.parse(options.body) : {};
  if (path === '/api/auth/status') {
    return new Response(JSON.stringify({ passwordSet: true, noAuthentication: false, demoEnabled: true }), { status: 200 });
  }
  if (path === '/api/auth/unlock') {
    if (body.password === 'secreto') return new Response(JSON.stringify({ ok: true, token: makeToken(), demoEnabled: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }
  if (path === '/api/auth/verify') {
    const hasAuth = !!(options.headers || {}).Authorization;
    if (hasAuth && verifyOk) return new Response(JSON.stringify({ ok: true, demoEnabled: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }
  if (path === '/api/auth/password') {
    return new Response(JSON.stringify({ ok: true, token: makeToken() }), { status: 200 });
  }
  if (path === '/api/auth/lock') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};

const { authState, initAuth, setMasterPassword, unlockWithPassword, lockNow, hasValidSession, SESSION_DAYS, reverify } =
  await import('../src/state/authState.js');

test('sesión dura 30 días', () => {
  assert.equal(SESSION_DAYS, 30);
});

test('initAuth consulta el servidor: con contraseña y sin token → bloqueado', async () => {
  await initAuth();
  assert.equal(authState.ready.value, true);
  assert.equal(authState.passwordRequired.value, true);
  assert.equal(authState.isLocked.value, true);
  assert.equal(hasValidSession(), false);
});

test('servidor inalcanzable marca serverUnreachable (no hay modo local)', async () => {
  serverDown = true;
  authState.ready.value = false;
  await initAuth();
  assert.equal(authState.serverUnreachable.value, true);

  serverDown = false;
  authState.ready.value = false;
  await initAuth();
  assert.equal(authState.serverUnreachable.value, false);
  assert.equal(authState.isLocked.value, true);
});

test('contraseña incorrecta no desbloquea ni guarda token', async () => {
  const ok = await unlockWithPassword('incorrecta');
  assert.equal(ok, false);
  assert.equal(authState.isLocked.value, true);
  assert.equal(values.has('yt_session_token'), false);
});

test('contraseña correcta desbloquea y guarda el token', async () => {
  const ok = await unlockWithPassword('secreto');
  assert.equal(ok, true);
  assert.equal(authState.isLocked.value, false);
  assert.ok(values.get('yt_session_token'));
  assert.equal(hasValidSession(), true);
});

test('lockNow descarta la sesión y avisa al servidor', async () => {
  lockNow();
  assert.equal(authState.isLocked.value, true);
  assert.equal(values.has('yt_session_token'), false);
  assert.equal(hasValidSession(), false);
});

test('setMasterPassword delega al servidor y abre sesión', async () => {
  const ok = await setMasterPassword('nueva');
  assert.equal(ok, true);
  assert.equal(authState.passwordRequired.value, true);
  assert.equal(authState.isLocked.value, false);
  assert.ok(hasValidSession());
});

test('reverify re-bloquea cuando la sesión se revoca en el servidor', async () => {
  await unlockWithPassword('secreto');
  assert.equal(authState.isLocked.value, false);

  verifyOk = true;
  await reverify();
  assert.equal(authState.isLocked.value, false);

  verifyOk = false;
  await reverify();
  assert.equal(authState.isLocked.value, true);
});
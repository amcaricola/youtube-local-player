import test from 'node:test';
import assert from 'node:assert/strict';

// authState con NO_AUTHENTICATION=true en el servidor: no se pide contraseña
// (modo recuperación) y se expone authDisabled para avisar en la UI.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

globalThis.fetch = async (path) => {
  if (path === '/api/auth/status') {
    return new Response(JSON.stringify({ passwordSet: true, noAuthentication: true }), { status: 200 });
  }
  if (path === '/api/auth/unlock') {
    const body = Buffer.from(JSON.stringify({ exp: Date.now() + 86400000000 })).toString('base64url');
    return new Response(JSON.stringify({ ok: true, token: `${body}.sig` }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};

values.set('app_mode', 'servidor');

const { authState, initAuth, unlockWithPassword } =
  await import(`../src/state/authState.js?noauth=${Date.now()}`);

test('con la autenticación desactivada no se pide contraseña ni hay lock', async () => {
  await initAuth();
  assert.equal(authState.ready.value, true);
  assert.equal(authState.authDisabled.value, true);
  assert.equal(authState.passwordRequired.value, false);
  assert.equal(authState.isLocked.value, false);
});

test('unlock queda abierto (bypass) en modo recuperación', async () => {
  const ok = await unlockWithPassword('cualquier-cosa');
  assert.equal(ok, true);
  assert.equal(authState.isLocked.value, false);
});
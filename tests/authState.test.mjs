import test from 'node:test';
import assert from 'node:assert/strict';

// authState y settingsState leen localStorage a nivel módulo: mockear antes de importar.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const {
  authState,
  setMasterPassword,
  unlockWithPassword,
  lockNow,
  hasValidSession,
  SESSION_DAYS
} = await import('../src/state/authState.js');

test('sesión dura 30 días', () => {
  assert.equal(SESSION_DAYS, 30);
});

test('sin contraseña maestra la instancia no pide acceso', () => {
  assert.equal(authState.passwordRequired.value, false);
  assert.equal(authState.isLocked.value, false);
});

test('al definir contraseña queda activa y con sesión abierta', () => {
  setMasterPassword('secreto');
  assert.equal(authState.passwordRequired.value, true);
  assert.equal(authState.isLocked.value, false);
  assert.ok(hasValidSession());
});

test('bloquear ahora descarta la sesión', () => {
  lockNow();
  assert.equal(authState.isLocked.value, true);
  assert.equal(hasValidSession(), false);
});

test('contraseña incorrecta no desbloquea', () => {
  const ok = unlockWithPassword('incorrecta');
  assert.equal(ok, false);
  assert.equal(authState.isLocked.value, true);
});

test('contraseña correcta desbloquea y abre sesión de 30 días', () => {
  const ok = unlockWithPassword('secreto');
  assert.equal(ok, true);
  assert.equal(authState.isLocked.value, false);
  assert.ok(hasValidSession());

  const exp = Number(values.get('yt_session_expires_at'));
  assert.ok(exp > Date.now() && exp <= Date.now() + 30 * 86400000);
});

test('una sesión vencida vuelve a pedir la contraseña al recargar', async () => {
  setMasterPassword('secreto');
  values.set('yt_session_expires_at', String(Date.now() - 1000));

  // Simular recarga: reimportar el módulo con cache-busting por query string.
  const fresh = await import(`../src/state/authState.js?reload=${Date.now()}`);
  assert.equal(fresh.authState.passwordRequired.value, true);
  assert.equal(fresh.authState.isLocked.value, true);
});

test('eliminar la contraseña quita la protección', () => {
  setMasterPassword('');
  assert.equal(authState.passwordRequired.value, false);
  assert.equal(authState.isLocked.value, false);
  assert.equal(values.has('yt_master_password'), false);
});
import test from 'node:test';
import assert from 'node:assert/strict';

// settingsState y modeState leen localStorage a nivel módulo: mockear antes.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

let postedBody = null;
globalThis.fetch = async (path, options = {}) => {
  postedBody = JSON.parse(options.body || '{}');
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

const { settingsState, setDemoEnabled } = await import('../src/state/settingsState.js');

test('la versión demo está habilitada por defecto', () => {
  assert.equal(settingsState.demoEnabled.value, true);
});

test('deshabilitar la demo se persiste en el servidor, no en localStorage', () => {
  setDemoEnabled(false);
  assert.equal(settingsState.demoEnabled.value, false);
  assert.equal(postedBody.demoEnabled, false);
  assert.equal(values.has('yt_demo_enabled'), false);
});

test('con la demo deshabilitada, la ruta /demo deja de activar el modo demo', async () => {
  // demoEnabled=false (decisión del servidor) + ruta /demo → modo none.
  settingsState.demoEnabled.value = false;
  globalThis.location = { pathname: '/demo' };

  const { modeState } = await import('../src/state/modeState.js');
  assert.equal(modeState.isDemo.value, false);
  assert.equal(modeState.mode.value, 'none');
});
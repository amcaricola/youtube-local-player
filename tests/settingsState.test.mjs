import test from 'node:test';
import assert from 'node:assert/strict';

// settingsState y modeState leen localStorage a nivel módulo: mockear antes.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const { settingsState } = await import('../src/state/settingsState.js');

test('la versión demo está habilitada por defecto', () => {
  assert.equal(settingsState.demoEnabled.value, true);
});

test('deshabilitar la demo se persiste en localStorage', () => {
  settingsState.demoEnabled.value = false;
  assert.equal(values.get('yt_demo_enabled'), 'false');
  assert.equal(settingsState.demoEnabled.value, false);
});

test('con la demo deshabilitada, la ruta /demo deja de activar el modo demo', async () => {
  // Reiniciar la cadena de módulos con el storage ya marcado y ruta /demo.
  const routeValues = new Map([['yt_demo_enabled', 'false']]);
  globalThis.localStorage = {
    getItem: key => routeValues.get(key) ?? null,
    setItem: (key, value) => routeValues.set(key, String(value)),
    removeItem: key => routeValues.delete(key)
  };
  globalThis.location = { pathname: '/demo' };

  const { modeState } = await import('../src/state/modeState.js');
  assert.equal(modeState.isDemo.value, false);
  assert.equal(modeState.mode.value, 'none');
});
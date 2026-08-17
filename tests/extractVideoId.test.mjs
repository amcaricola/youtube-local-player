import { test } from 'node:test';
import assert from 'node:assert/strict';

// settingsState.js lee localStorage a nivel módulo: hay que mockearlo
// ANTES de importar youtubeApi.js.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const { extractVideoId } = await import('../src/api/youtubeApi.js');

const ID = 'dQw4w9WgXcQ';

test('extrae un videoId crudo de 11 caracteres', () => {
  assert.equal(extractVideoId(ID), ID);
});

test('extrae de watch?v=', () => {
  assert.equal(extractVideoId(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(extractVideoId(`https://youtube.com/watch?v=${ID}&t=42s`), ID);
});

test('extrae de youtu.be/', () => {
  assert.equal(extractVideoId(`https://youtu.be/${ID}`), ID);
});

test('extrae de shorts, embed y live', () => {
  assert.equal(extractVideoId(`https://www.youtube.com/shorts/${ID}`), ID);
  assert.equal(extractVideoId(`https://www.youtube.com/embed/${ID}`), ID);
  assert.equal(extractVideoId(`https://www.youtube.com/live/${ID}`), ID);
});

test('funciona sin protocolo', () => {
  assert.equal(extractVideoId(`www.youtube.com/watch?v=${ID}`), ID);
});

test('rechaza entradas inválidas', () => {
  assert.equal(extractVideoId(''), null);
  assert.equal(extractVideoId('https://www.youtube.com/watch?x=1'), null);
  assert.equal(extractVideoId('abc'), null);
  assert.equal(extractVideoId('not-a-url'), null);
});

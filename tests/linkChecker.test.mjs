import test from 'node:test';
import assert from 'node:assert/strict';

// settingsState.js lee localStorage a nivel módulo: hay que mockearlo
// ANTES de importar la cadena de módulos del checker.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const {
  buildTrackUpdates,
  getRecoveryDaysLeft,
  isRecoveryExpired,
  needsCheck,
  parseISO8601Duration,
  RECOVERY_WINDOW_MS
} = await import('../src/api/linkStatus.js');

const DAY_MS = 24 * 60 * 60 * 1000;

const baseTrack = {
  id: 't1',
  videoId: 'abc123',
  title: 'Mi Canción',
  artist: 'Mi Artista',
  thumbnailUrl: 'https://i.ytimg.com/vi/abc123/default.jpg',
  publishedAt: '2020-01-01T00:00:00Z',
  durationSeconds: 245,
  status: 'healthy',
  statusMessage: null,
  brokenAt: null,
  metadataFetchedAt: Date.now(),
  addedAt: Date.now(),
  lastCheckedAt: Date.now()
};

const healthyInfo = {
  status: 'healthy',
  message: null,
  snippet: {
    publishedAt: '2020-01-02T00:00:00Z',
    thumbnails: { default: { url: 'https://i.ytimg.com/vi/abc123/new.jpg' } }
  },
  durationSeconds: 250
};

test('parseISO8601Duration convierte duraciones de YouTube a segundos', () => {
  assert.equal(parseISO8601Duration('PT4M13S'), 253);
  assert.equal(parseISO8601Duration('PT1H2M3S'), 3723);
  assert.equal(parseISO8601Duration('PT45S'), 45);
  assert.equal(parseISO8601Duration(undefined), null);
  assert.equal(parseISO8601Duration('invalid'), null);
});

test('video vivo refresca metadata de la API sin tocar título/artista del usuario', () => {
  const updates = buildTrackUpdates(baseTrack, healthyInfo);
  assert.equal(updates.status, 'healthy');
  assert.equal(updates.publishedAt, '2020-01-02T00:00:00Z');
  assert.equal(updates.thumbnailUrl, 'https://i.ytimg.com/vi/abc123/new.jpg');
  assert.equal(updates.durationSeconds, 250);
  assert.equal(updates.brokenAt, null);
  assert.ok(updates.metadataFetchedAt > 0);
  assert.equal(updates.title, undefined);
  assert.equal(updates.artist, undefined);
});

test('link roto registra brokenAt y conserva la metadata dentro de la ventana', () => {
  const now = Date.now();
  const updates = buildTrackUpdates(baseTrack, { status: 'broken', message: 'Video eliminado o no disponible' }, now);
  assert.equal(updates.status, 'broken');
  assert.equal(updates.brokenAt, now);
  assert.equal(updates.publishedAt, undefined); // no se purga todavía
  assert.equal(updates.thumbnailUrl, undefined);
});

test('link roto re-detectado conserva el brokenAt original (no reinicia el plazo)', () => {
  const brokenTrack = { ...baseTrack, status: 'broken', brokenAt: Date.now() - 5 * DAY_MS };
  const updates = buildTrackUpdates(brokenTrack, { status: 'broken', message: 'x' });
  assert.equal(updates.brokenAt, brokenTrack.brokenAt);
});

test('vencida la ventana de recuperación se purga la metadata de la API', () => {
  const expiredTrack = { ...baseTrack, status: 'broken', brokenAt: Date.now() - (RECOVERY_WINDOW_MS + DAY_MS) };
  const updates = buildTrackUpdates(expiredTrack, { status: 'broken', message: 'x' });
  assert.equal(updates.publishedAt, null);
  assert.equal(updates.thumbnailUrl, '');
  assert.equal(updates.durationSeconds, null);
  // título y artista del usuario jamás se tocan
  assert.equal(updates.title, undefined);
  assert.equal(updates.artist, undefined);
});

test('getRecoveryDaysLeft cuenta los días restantes solo en tracks rotos', () => {
  const brokenTrack = { ...baseTrack, status: 'broken', brokenAt: Date.now() - 3 * DAY_MS };
  const days = getRecoveryDaysLeft(brokenTrack);
  assert.ok(days >= 19 && days <= 20); // 23 días de ventana - 3 transcurridos
  assert.equal(getRecoveryDaysLeft(baseTrack), null);
});

test('isRecoveryExpired solo cuando el plazo venció y aún hay metadata que purgar', () => {
  const expired = { ...baseTrack, status: 'broken', brokenAt: Date.now() - (RECOVERY_WINDOW_MS + DAY_MS) };
  assert.equal(isRecoveryExpired(expired), true);

  const purged = { ...expired, publishedAt: null, thumbnailUrl: '', durationSeconds: null };
  assert.equal(isRecoveryExpired(purged), false);

  const recent = { ...baseTrack, status: 'broken', brokenAt: Date.now() - DAY_MS };
  assert.equal(isRecoveryExpired(recent), false);

  assert.equal(isRecoveryExpired(baseTrack), false);
});

test('un track revisado hoy NO se vuelve a consultar (límite diario)', () => {
  const checkedToday = { ...baseTrack, lastCheckedAt: Date.now() - 60 * 1000 };
  assert.equal(needsCheck(checkedToday), false);
});

test('un track con datos faltantes se consulta una vez al día aunque falten datos', () => {
  const missingDataCheckedToday = {
    ...baseTrack,
    publishedAt: null,
    lastCheckedAt: Date.now() - 60 * 1000
  };
  assert.equal(needsCheck(missingDataCheckedToday), false);

  const missingDataNotToday = {
    ...baseTrack,
    publishedAt: null,
    lastCheckedAt: Date.now() - (DAY_MS + 60 * 1000)
  };
  assert.equal(needsCheck(missingDataNotToday), true);
});

test('un track verificado ayer vuelve a consultarse hoy', () => {
  const checkedYesterday = { ...baseTrack, lastCheckedAt: Date.now() - (DAY_MS + 60 * 1000) };
  assert.equal(needsCheck(checkedYesterday), true);
});

test('un track healthy recién verificado no entra al barrido', () => {
  const healthyToday = {
    ...baseTrack,
    status: 'healthy',
    lastCheckedAt: Date.now() - 30 * 60 * 1000,
    metadataFetchedAt: Date.now()
  };
  assert.equal(needsCheck(healthyToday), false);
});

test('un track nunca verificado (sin lastCheckedAt) siempre entra al barrido', () => {
  assert.equal(needsCheck({ ...baseTrack, lastCheckedAt: null }), true);
});

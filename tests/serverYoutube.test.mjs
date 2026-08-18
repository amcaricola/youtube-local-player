import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Configuración aislada: los tests usan un .config.json temporal.
const tmp = await mkdtemp(join(tmpdir(), 'yt-youtube-'));
process.env.YT_CONFIG_PATH = join(tmp, 'config.json');
process.env.YT_SESSIONS_PATH = join(tmp, 'sessions.json');

const { createApp } = await import('../server/app.js');

const app = createApp();

test.after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

// Mock del upstream de Google: el proxy del servidor usa globalThis.fetch.
// Solo afecta a las llamadas internas de /api/youtube (app.request no usa fetch).
const mockGoogle = (routes) => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const hit = routes.find(r => u.includes(r.match));
    if (!hit) return { ok: false, status: 500, json: async () => ({ error: { message: 'no mock' } }) };
    return { ok: true, status: 200, json: async () => hit.data };
  };
};

const post = (path, body, token) => app.request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
  body: JSON.stringify(body)
});

test('sin API key el status lo reporta y las rutas de datos piden key', async () => {
  const status = await app.request('/api/youtube/status');
  assert.deepEqual(await status.json(), { ok: true, hasKey: false });

  mockGoogle([]);
  const videos = await app.request('/api/youtube/videos?ids=abc,def');
  assert.equal(videos.status, 400);
  assert.equal((await videos.json()).error.includes('API key'), true);
});

test('guardar la API key la valida y la persiste en el config del servidor', async () => {
  mockGoogle([{ match: 'videos', data: { items: [{ id: 'dQw4w9WgXcQ' }] } }]);
  const res = await post('/api/youtube/key', { apiKey: 'AIza-fake-valid' });
  assert.equal((await res.json()).ok, true);

  const status = await app.request('/api/youtube/status');
  assert.equal((await status.json()).hasKey, true);

  const cfg = JSON.parse(await readFile(process.env.YT_CONFIG_PATH, 'utf8'));
  assert.equal(cfg.youtubeApiKey, 'AIza-fake-valid');
});

test('una API key inválida no se guarda', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) });
  const res = await post('/api/youtube/key', { apiKey: 'mala' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).ok, false);

  const status = await app.request('/api/youtube/status');
  assert.equal((await status.json()).hasKey, true); // sigue la anterior
});

test('GET /videos devuelve los items que trae el servidor de Google', async () => {
  mockGoogle([{ match: 'videos', data: { items: [{ id: 'aaa', snippet: { title: 'x' }, status: { embeddable: true } }] } }]);
  const res = await app.request('/api/youtube/videos?ids=aaa');
  assert.equal((await res.json()).items.length, 1);
});

test('GET /search mapea los resultados para el modal de reemplazo', async () => {
  mockGoogle([
    { match: 'search', data: { items: [{ id: { videoId: 'bbb' }, snippet: { title: 'T', channelTitle: 'C', thumbnails: { medium: { url: 'u' } } } }] } },
    { match: 'videos', data: { items: [{ id: 'bbb', status: { embeddable: true, privacyStatus: 'public' } }] } },
    { match: 'oembed', data: {} }
  ]);
  const res = await app.request('/api/youtube/search?q=demo');
  const data = await res.json();
  assert.deepEqual(data.items, [{ videoId: 'bbb', title: 'T', channelTitle: 'C', thumbnailUrl: 'u' }]);
});

test('GET /search descarta resultados con el embed bloqueado o no públicos', async () => {
  mockGoogle([
    {
      match: 'search',
      data: { items: [
        { id: { videoId: 'emb' }, snippet: { title: 'T1', channelTitle: 'C1', thumbnails: { medium: { url: 'u1' } } } },
        { id: { videoId: 'no-emb' }, snippet: { title: 'T2', channelTitle: 'C2', thumbnails: { medium: { url: 'u2' } } } },
        { id: { videoId: 'priv' }, snippet: { title: 'T3', channelTitle: 'C3', thumbnails: { medium: { url: 'u3' } } } },
        { id: { videoId: 'unlisted' }, snippet: { title: 'T4', channelTitle: 'C4', thumbnails: { medium: { url: 'u4' } } } }
      ] }
    },
    {
      match: 'videos',
      data: { items: [
        { id: 'emb', status: { embeddable: true, privacyStatus: 'public' } },
        { id: 'no-emb', status: { embeddable: false, privacyStatus: 'public' } },
        { id: 'priv', status: { embeddable: true, privacyStatus: 'private' } },
        { id: 'unlisted', status: { embeddable: true, privacyStatus: 'unlisted' } }
      ] }
    },
    { match: 'oembed', data: {} }
  ]);
  const res = await app.request('/api/youtube/search?q=demo');
  const data = await res.json();
  assert.deepEqual(data.items.map(i => i.videoId), ['emb']);
});

test('GET /search descarta videos que oEmbed no puede incrustar (Content ID)', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/oembed')) {
      // 'cid-blocked' pasa el filtro de la API pero su embedding está bloqueado
      // a nivel de reproductor (p. ej. reclamo de sello discográfico).
      const ok = u.includes('cid-blocked') ? false : true;
      return { ok, status: ok ? 200 : 401, json: async () => ({}) };
    }
    if (u.includes('search')) {
      return { ok: true, status: 200, json: async () => ({ items: [
        { id: { videoId: 'ok-id' }, snippet: { title: 'T1', channelTitle: 'C1', thumbnails: { medium: { url: 'u1' } } } },
        { id: { videoId: 'cid-blocked' }, snippet: { title: 'T2', channelTitle: 'C2', thumbnails: { medium: { url: 'u2' } } } }
      ] }) };
    }
    if (u.includes('videos')) {
      return { ok: true, status: 200, json: async () => ({ items: [
        { id: 'ok-id', status: { embeddable: true, privacyStatus: 'public' } },
        { id: 'cid-blocked', status: { embeddable: true, privacyStatus: 'public' } }
      ] }) };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  const res = await app.request('/api/youtube/search?q=trivium');
  const data = await res.json();
  assert.deepEqual(data.items.map(i => i.videoId), ['ok-id']);
});

test('GET /playlist pagina los playlistItems y devuelve metadata', async () => {
  let itemsCalls = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('playlistItems')) {
      itemsCalls++;
      return { ok: true, status: 200, json: async () => itemsCalls === 1
        ? { items: [{ contentDetails: { videoId: 'v1' } }], nextPageToken: 'p2' }
        : { items: [{ contentDetails: { videoId: 'v2' } }] } };
    }
    if (u.includes('playlists')) {
      return { ok: true, status: 200, json: async () => ({ items: [{ snippet: { title: 'Mix', description: 'd', thumbnails: { medium: { url: 't' } } } }] }) };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  const res = await app.request('/api/youtube/playlist?listId=PL1');
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.title, 'Mix');
  assert.equal(data.rawItems.length, 2);
});

test('DELETE /key elimina la API key del servidor', async () => {
  const status = await app.request('/api/youtube/status');
  assert.equal((await status.json()).hasKey, true);

  const del = await app.request('/api/youtube/key', { method: 'DELETE' });
  assert.equal((await del.json()).ok, true);

  const after = await app.request('/api/youtube/status');
  assert.equal((await after.json()).hasKey, false);
});

test('con contraseña, /api/youtube exige sesión válida', async () => {
  const set = await post('/api/auth/password', { password: 'clave-youtube' });
  const { token } = await set.json();

  const noToken = await app.request('/api/youtube/status');
  assert.equal(noToken.status, 401);

  mockGoogle([{ match: 'videos', data: { items: [{ id: 'dQw4w9WgXcQ' }] } }]);
  const withToken = await app.request('/api/youtube/key', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: token },
    body: JSON.stringify({ apiKey: 'AIza-con-sesion' })
  });
  assert.equal((await withToken.json()).ok, true);
});
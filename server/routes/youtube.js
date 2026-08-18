import { Hono } from 'hono';
import { loadConfig, saveConfig } from '../config.js';
import { verifySession } from '../auth.js';

// F3: proxy YouTube server-side. El navegador nunca conoce ni guarda la API
// key: vive en `server/.config.json` (config.ini) y el servidor la usa para
// llamar a la Data API v3. Toda la ruta /api/youtube/* exige la misma
// autorización que la biblioteca (abierta sin contraseña, token de sesión si
// hay contraseña) para evitar usos ajenos y abusos de cuota.
const YT_API = 'https://www.googleapis.com/youtube/v3';

const authorized = (c, cfg) => {
  if (cfg.noAuthentication === true || !cfg.masterPasswordHash) return true;
  return !!verifySession(c.req.header('Authorization') || '');
};

/**
 * Llama a la Data API v3 con la key del servidor.
 * Lanza un Error con `.status` para que el handler lo devuelva como HTTP.
 */
const ytFetch = async (path, cfg, params) => {
  const key = cfg.youtubeApiKey;
  if (!key) {
    const err = new Error('No hay API key de YouTube configurada en el servidor.');
    err.status = 400;
    throw err;
  }
  const query = new URLSearchParams(params);
  query.set('key', key);
  const res = await fetch(`${YT_API}${path}?${query}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `YouTube API ${res.status}`);
    err.status = res.status || 500;
    throw err;
  }
  return data;
};

const guard = async (c, cfg, fn) => {
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);
  try {
    return await fn();
  } catch (e) {
    return c.json({ ok: false, error: e.message }, e.status || 500);
  }
};

export const youtubeRoutes = new Hono();

// ¿Hay API key configurada en el servidor? (nunca expone la key en sí).
youtubeRoutes.get('/status', (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);
  return c.json({ ok: true, hasKey: !!cfg.youtubeApiKey });
});

// Guarda/reemplaza la API key en el config del servidor, validándola antes.
youtubeRoutes.post('/key', (c) => guard(c, loadConfig(), async () => {
  const { apiKey } = await c.req.json().catch(() => ({}));
  const key = String(apiKey || '').trim();
  if (!key) return c.json({ ok: false, error: 'La API key no puede estar vacía.' }, 400);

  // Validación mínima contra Google antes de persistir.
  await ytFetch('/videos', { ...loadConfig(), youtubeApiKey: key }, { part: 'snippet', id: 'dQw4w9WgXcQ' });
  saveConfig({ youtubeApiKey: key });
  return c.json({ ok: true });
}));

// Elimina la API key del servidor.
youtubeRoutes.delete('/key', (c) => guard(c, loadConfig(), () => {
  saveConfig({ youtubeApiKey: null });
  return c.json({ ok: true });
}));

// videos.list (estado + metadata): lo usa el link checker en lotes.
youtubeRoutes.get('/videos', (c) => guard(c, loadConfig(), async () => {
  const ids = c.req.query('ids');
  if (!ids) return c.json({ ok: false, error: 'Falta ids.' }, 400);
  const data = await ytFetch('/videos', loadConfig(), { part: 'snippet,status,contentDetails', id: ids });
  return c.json({ ok: true, items: data.items || [] });
}));

// playlists + playlistItems (paginado): importar y sincronizar.
youtubeRoutes.get('/playlist', (c) => guard(c, loadConfig(), async () => {
  const playlistId = c.req.query('listId');
  if (!playlistId) return c.json({ ok: false, error: 'Falta listId.' }, 400);
  const meta = await ytFetch('/playlists', loadConfig(), { part: 'snippet', id: playlistId });
  if (!meta.items?.length) {
    const err = new Error('Playlist no encontrada o es privada');
    err.status = 404;
    throw err;
  }
  const snippet = meta.items[0].snippet;

  let items = [];
  let nextPageToken = '';
  do {
    const page = await ytFetch('/playlistItems', loadConfig(), {
      part: 'snippet,contentDetails',
      maxResults: 50,
      playlistId,
      ...(nextPageToken ? { pageToken: nextPageToken } : {})
    });
    items = [...items, ...(page.items || [])];
    nextPageToken = page.nextPageToken || '';
  } while (nextPageToken);

  return c.json({
    ok: true,
    youtubePlaylistId: playlistId,
    title: snippet.title,
    description: snippet.description,
    thumbnail: snippet.thumbnails?.medium?.url || '',
    rawItems: items
  });
}));

// search.list: modal de reemplazo / búsqueda de copias reproducibles.
// El search NO trae `status.embeddable`, así que se cruza con videos.list y se
// descartan los resultados con el embed bloqueado o no públicos. Además, el
// `embeddable` de la API NO refleja los bloqueos por Content ID (p. ej. sellos
// discográficos que reclaman el video): por eso se añade una comprobación oEmbed
// (sin key ni cuota de la Data API) que devuelve 401 cuando el video no se puede
// incrustar a nivel de reproductor — que es exactamente lo que usa el iframe.
youtubeRoutes.get('/search', (c) => guard(c, loadConfig(), async () => {
  const q = c.req.query('q');
  if (!q) return c.json({ ok: false, error: 'Falta q.' }, 400);
  const maxResults = Number(c.req.query('maxResults') || 10);
  const data = await ytFetch('/search', loadConfig(), { part: 'snippet', type: 'video', maxResults, q });
  const raw = (data.items || [])
    .map(item => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || ''
    }))
    .filter(item => item.videoId);

  if (raw.length === 0) return c.json({ ok: true, items: [] });

  // Filtro 1: estado de la API (embeddable + público).
  const statusData = await ytFetch('/videos', loadConfig(), { part: 'status', id: raw.map(i => i.videoId).join(',') });
  const playable = new Set(
    (statusData.items || [])
      .filter(v => v.status?.embeddable === true && v.status?.privacyStatus === 'public')
      .map(v => v.id)
  );
  let candidates = raw.filter(i => playable.has(i.videoId));
  if (candidates.length === 0) return c.json({ ok: true, items: [] });

  // Filtro 2: oEmbed (HTTP 401 = no incrustable). Conservador: si la consulta
  // falla por red, se descarta el candidato.
  const verified = await Promise.all(candidates.map(async (item) => {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}&format=json`;
    const ok = await fetch(oembedUrl).then(r => r.ok).catch(() => false);
    return ok ? item : null;
  }));
  return c.json({ ok: true, items: verified.filter(Boolean) });
}));
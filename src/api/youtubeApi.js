import { isDemoRoute } from '../state/demoRoute.js';

// F3: toda la interacción con la YouTube Data API v3 pasa por el proxy del
// servidor (/api/youtube). El navegador nunca conoce ni persiste la API key:
// vive en server/.config.json y el servidor controla su uso. En modo demo la
// puerta queda bloqueada (la demo nunca debe tocar la key del super usuario).

const API_BASE = '/api/youtube';

const guardDemo = () => {
  if (isDemoRoute()) throw new Error('No disponible en versión demo');
};

const headers = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('yt_session_token') : '';
  return token ? { Authorization: token } : {};
};

const handleRes = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Error ${res.status}`);
  return data;
};

/**
 * ¿El servidor tiene una API key configurada? (nunca revela la key en sí).
 * @returns {Promise<boolean>}
 */
export const getKeyStatus = async () => {
  guardDemo();
  const data = await handleRes(await fetch(`${API_BASE}/status`, { headers: headers() }));
  return !!data.hasKey;
};

/**
 * Valida y guarda la API key en la config del servidor. La key viaja una vez
 * al servidor y NO se persiste en el navegador.
 * @param {string} apiKey
 */
export const saveKeyToServer = async (apiKey) => {
  guardDemo();
  await handleRes(await fetch(`${API_BASE}/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ apiKey })
  }));
};

/** Elimina la API key del servidor. */
export const removeServerKey = async () => {
  guardDemo();
  await handleRes(await fetch(`${API_BASE}/key`, { method: 'DELETE', headers: headers() }));
};

/**
 * Consulta el estado y la metadata de un lote de videos (el servidor usa su
 * propia key). Los videos que ya no existen no aparecen en `items`.
 * @param {string[]} videoIds
 * @returns {Promise<Array<{id: string, snippet: object, status: object, contentDetails: object}>>}
 */
export const fetchVideoStatusItems = async (videoIds) => {
  guardDemo();
  const data = await handleRes(await fetch(`${API_BASE}/videos?ids=${videoIds.join(',')}`, { headers: headers() }));
  return data.items || [];
};

/**
 * Obtiene la información completa de una playlist (metadata + todos los items,
 * con paginación hecha del lado del servidor).
 * @param {string} playlistId
 * @returns {Promise<{youtubePlaylistId: string, title: string, description: string, thumbnail: string, rawItems: Array}>}
 */
export const fetchPlaylistData = async (playlistId) => {
  guardDemo();
  return handleRes(await fetch(`${API_BASE}/playlist?listId=${encodeURIComponent(playlistId)}`, { headers: headers() }));
};

/**
 * Busca videos de reemplazo en YouTube. El servidor descarta los resultados
 * cuyo embed está bloqueado o no son públicos: lo que llega aquí es siempre
 * reproducible desde el iframe.
 * @param {string} query
 * @param {number} [maxResults=10]
 * @returns {Promise<Array<{videoId: string, title: string, channelTitle: string, thumbnailUrl: string}>>}
 */
export const searchVideos = async (query, maxResults = 10) => {
  guardDemo();
  const data = await handleRes(await fetch(
    `${API_BASE}/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: headers() }
  ));
  return data.items || [];
};

/**
 * Extrae el ID de la playlist desde una URL de YouTube (o un ID crudo).
 * @param {string} url
 * @returns {string|null}
 */
export const extractPlaylistId = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('list');
  } catch (e) {
    return null;
  }
};

/**
 * Extrae un videoId de YouTube a partir de un link o de un ID crudo.
 * Soporta youtu.be/ID, youtube.com/watch?v=ID, shorts, embed, live y
 * un ID directo de 11 caracteres.
 * @param {string} input
 * @returns {string|null}
 */
export const extractVideoId = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.hostname === 'youtu.be') return validateId(url.pathname.slice(1));
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      const v = url.searchParams.get('v');
      if (v) return validateId(v);
      const path = url.pathname.split('/').filter(Boolean);
      if (path[0] === 'shorts' || path[0] === 'embed' || path[0] === 'live' || path[0] === 'v') {
        return validateId(path[1]);
      }
    }
  } catch (e) {
    return null;
  }
  return null;
};

const validateId = (id) => (id && /^[A-Za-z0-9_-]{11}$/.test(id)) ? id : null;
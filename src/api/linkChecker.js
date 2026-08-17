import { signal } from '@preact/signals';
import { playerState } from '../state/playerState.js';
import { playlistState, updateTrackMetadata } from '../state/playlistState.js';
import { settingsState } from '../state/settingsState.js';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 50;
const AUTO_INTERVAL_MS = 60 * 1000;
const MANUAL_INTERVAL_MS = 5 * 1000;
// Cada track se verifica como máximo UNA vez por día: si ya se consultó hoy,
// el barrido no vuelve a llamar a la API (evita saturarla con cada recarga de página).
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Política de retención (Developer Policies III.E.4): ningún dato de la API
// puede superar 30 días sin refrescarse. Como el barrido re-chequea como máximo
// 1 vez al día, cuando un link se rompe su metadata tiene <=1 día de antigüedad,
// así que la ventana de recuperación de 23 días es conservadora desde la detección.
export const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const RECOVERY_WINDOW_MS = 23 * 24 * 60 * 60 * 1000;

export const linkCheckerState = {
  isRunning: signal(false)
};

let isRunning = false;
let shouldStop = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Convierte una duración ISO 8601 de YouTube (PT4M13S) a segundos.
 * @param {string|undefined} iso
 * @returns {number|null}
 */
export const parseISO8601Duration = (iso) => {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

/**
 * Días que le quedan a un track roto para ser reparado antes de que su
 * metadata de la API (fecha, miniatura, duración) se purgue. El título y
 * artista del usuario se conservan siempre.
 * @param {import('../types/player.js').Track} track
 * @returns {number|null} null si el track no está roto o no tiene fecha de detección
 */
export const getRecoveryDaysLeft = (track) => {
  if (track?.status !== 'broken' || !track.brokenAt) return null;
  return Math.ceil((track.brokenAt + RECOVERY_WINDOW_MS - Date.now()) / (24 * 60 * 60 * 1000));
};

/**
 * Track roto cuyo plazo de recuperación venció y aún conserva metadata de la API.
 */
export const isRecoveryExpired = (track) =>
  track.status === 'broken' &&
  !!track.brokenAt &&
  Date.now() - track.brokenAt > RECOVERY_WINDOW_MS &&
  (!!track.publishedAt || !!track.thumbnailUrl || track.durationSeconds != null);

/**
 * Decide si un track necesita verificación este barrido.
 *
 * Regla principal: si el track ya fue verificado HOY, no se vuelve a consultar
 * (aunque le falten datos) para no saturar la API en recargas de página.
 * Solo si NO se revisó hoy se evalúan las condiciones:
 *   - nunca verificado, en warning, o con metadata de la API cerca del límite
 *     de 30 días, o roto con la ventana de recuperación vencida (pendiente de purga)
 *   - con chequeo viejo (más de 1 día)
 *   - con datos de API faltantes (p. ej. sin fecha de publicación) — en ese caso
 *     la petición se hace para completarlos, una vez por día como máximo.
 */
const needsCheck = (track) => {
  if (track.lastCheckedAt && Date.now() - track.lastCheckedAt < CHECK_INTERVAL_MS) {
    return false;
  }
  return (
    track.status === 'unchecked' ||
    track.status === 'warning' ||
    !track.lastCheckedAt ||
    Date.now() - track.lastCheckedAt >= CHECK_INTERVAL_MS ||
    Date.now() - (track.metadataFetchedAt || 0) > METADATA_MAX_AGE_MS ||
    (!track.publishedAt && track.status !== 'broken') ||
    isRecoveryExpired(track)
  );
};

export { needsCheck };

/**
 * Consulta el estado y la metadata de un lote de videos.
 * Un solo request por lote (status + snippet + contentDetails cuestan lo mismo),
 * así cada verificación también renueva la metadata de la API (regla de 30 días).
 * Videos que ya no existen en YouTube no aparecen en la respuesta => se marcan como rotos.
 * @param {string[]} videoIds
 * @param {string} apiKey
 */
const fetchVideoStatus = async (videoIds, apiKey) => {
  const res = await fetch(`${BASE_URL}/videos?part=snippet,status,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`);
  if (!res.ok) {
    throw new Error((await res.json()).error?.message || 'Error al verificar videos');
  }
  const data = await res.json();

  const statuses = {};
  for (const id of videoIds) {
    statuses[id] = { status: 'broken', message: 'Video eliminado o no disponible' };
  }
  for (const item of data.items || []) {
    const st = item.status;
    let status = 'healthy';
    let message = null;
    if (st.uploadStatus === 'rejected' || st.uploadStatus === 'failed') {
      status = 'broken';
      message = `Video ${st.uploadStatus}`;
    } else if (st.privacyStatus === 'private') {
      status = 'warning';
      message = 'Video privado';
    } else if (st.embeddable === false) {
      status = 'warning';
      message = 'Reproducción embebida bloqueada';
    }
    statuses[item.id] = {
      status,
      message,
      snippet: item.snippet,
      durationSeconds: parseISO8601Duration(item.contentDetails?.duration)
    };
  }
  return statuses;
};

/**
 * Construye las actualizaciones para un track a partir del resultado del checker:
 * - Videos vivos: refresca la metadata de la API (fecha, miniatura, duración)
 *   para mantenerla siempre dentro de la ventana de 30 días. NUNCA pisa el
 *   título/artista editados por el usuario.
 * - Links rotos: registra `brokenAt`; si la ventana de recuperación venció,
 *   purga la metadata de la API (se conservan videoId, título y artista).
 * Exportado para pruebas.
 */
export const buildTrackUpdates = (track, info, now = Date.now()) => {
  const updates = {
    status: info.status,
    statusMessage: info.message,
    lastCheckedAt: now
  };

  if (info.status === 'broken') {
    updates.brokenAt = track.brokenAt || now;
    if (now - updates.brokenAt > RECOVERY_WINDOW_MS) {
      updates.publishedAt = null;
      updates.thumbnailUrl = '';
      updates.durationSeconds = null;
    }
  } else {
    updates.brokenAt = null;
  }

  if (info.snippet) {
    updates.publishedAt = info.snippet.publishedAt ?? track.publishedAt ?? null;
    updates.thumbnailUrl = info.snippet.thumbnails?.default?.url || track.thumbnailUrl || '';
    updates.durationSeconds = info.durationSeconds ?? track.durationSeconds ?? null;
    updates.metadataFetchedAt = now;
  }
  return updates;
};

/**
 * Verifica las playlists en cascada una sola vez por sesión:
 * - un lote de BATCH_SIZE (50) videos por request
 * - automatático: 1 lote por minuto (no molesta, respeta la cuota de la API)
 * - manual: 1 lote cada 5 segundos
 * Cada track se consulta como máximo UNA vez al día: si ya se revisó hoy, se
 * salta aunque se recargue la página. Solo entra al barrido lo pendiente
 * (no verificado, warning, chequeo viejo >1 día, datos de API faltantes,
 * metadata cerca del límite de 30 días o rotos pendientes de purga).
 * @param {boolean} [manual=false] Si es manual, ignora el toggle de verificación automática.
 */
export const runCascadingLinkCheck = async (manual = false) => {
  if (isRunning) return;
  if (!manual && !settingsState.autoCheckLinks.value) return;
  const apiKey = settingsState.apiKey.value;
  if (!apiKey) return;

  const interval = manual ? MANUAL_INTERVAL_MS : AUTO_INTERVAL_MS;
  isRunning = true;
  shouldStop = false;
  linkCheckerState.isRunning.value = true;

  try {
    for (const playlist of playlistState.playlists.value) {
      if (shouldStop) break;
      const pending = playlist.tracks.filter(needsCheck);

      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        if (shouldStop) break;
        const chunk = pending.slice(i, i + BATCH_SIZE);
        try {
          const results = await fetchVideoStatus(chunk.map(t => t.videoId), apiKey);
          for (const [videoId, info] of Object.entries(results)) {
            const track = chunk.find(t => t.videoId === videoId);
            if (track) {
              await updateTrackMetadata(playlist.id, track.id, buildTrackUpdates(track, info));
            }
          }
        } catch (error) {
          // Quota agotada, red caída, etc. Detener la cascada para no saturar.
          console.error("[LinkChecker] Error en lote:", error);
          shouldStop = true;
          break;
        }
        await sleep(interval);
      }
    }
  } finally {
    isRunning = false;
    linkCheckerState.isRunning.value = false;
  }
};

export const stopLinkCheck = () => {
  shouldStop = true;
};

/**
 * Consulta la información completa de un único video (estado + metadata).
 * Reutiliza el mismo request que el checker para no duplicar cuota.
 * Usado al agregar una canción manualmente con API Key.
 * @param {string} videoId
 * @param {string} apiKey
 * @returns {Promise<{status: string, message: string|null, snippet: object, durationSeconds: number|null}|null>}
 */
export const fetchVideoInfo = async (videoId, apiKey) => {
  if (!apiKey || !videoId) return null;
  const results = await fetchVideoStatus([videoId], apiKey);
  return results[videoId] || null;
};

/**
 * Verifica un único track (usado tras reparar un link) y persiste el resultado.
 * @param {string} playlistId
 * @param {import('../types/player.js').Track} track
 */
export const checkTrackNow = async (playlistId, track) => {
  const apiKey = settingsState.apiKey.value;
  if (!apiKey || !track?.videoId) return;
  const results = await fetchVideoStatus([track.videoId], apiKey);
  const info = results[track.videoId];
  if (info) {
    await updateTrackMetadata(playlistId, track.id, buildTrackUpdates(track, info));
  }
  if (playerState.currentTrack.value?.id === track.id) {
    playerState.currentTrack.value = { ...playerState.currentTrack.value, status: info?.status || 'unchecked', statusMessage: info?.message || null };
  }
};

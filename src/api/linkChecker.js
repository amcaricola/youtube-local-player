import { signal } from '@preact/signals';
import { playerState } from '../state/playerState.js';
import { playlistState } from '../state/playlistState.js';
import { updateTrackMetadata } from '../state/playlistCrud.js';
import { settingsState } from '../state/settingsState.js';
import { fetchVideoStatusItems } from './youtubeApi.js';
import {
  buildTrackUpdates,
  needsCheck,
  parseISO8601Duration
} from './linkStatus.js';

const BATCH_SIZE = 50;
const AUTO_INTERVAL_MS = 60 * 1000;
const MANUAL_INTERVAL_MS = 5 * 1000;

export const linkCheckerState = {
  isRunning: signal(false)
};

let isRunning = false;
let shouldStop = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Consulta el estado y la metadata de un lote de videos a través del proxy del
 * servidor (que usa su propia API key). Un solo request por lote (status +
 * snippet + contentDetails cuestan lo mismo), así cada verificación también
 * renueva la metadata de la API (regla de 30 días). Videos que ya no existen
 * en YouTube no aparecen en la respuesta => se marcan como rotos.
 * @param {string[]} videoIds
 * @returns {Promise<Object<string, {status: string, message: string|null, snippet: object|null, durationSeconds: number|null}>>}
 */
const fetchVideoStatus = async (videoIds) => {
  const items = await fetchVideoStatusItems(videoIds);

  const statuses = {};
  for (const id of videoIds) {
    statuses[id] = { status: 'broken', message: 'Video eliminado o no disponible' };
  }
  for (const item of items) {
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
          // Se verifica el video que REALMENTE se reproduce (playableVideoId ||
          // videoId): si el track tiene una copia reproducible, su salud es la de
          // la copia, no la del ancla original (que puede tener el embed bloqueado
          // y volvería a marcarlo como aviso tras cada reparación).
          const results = await fetchVideoStatus(chunk.map(t => t.playableVideoId || t.videoId));
          for (const track of chunk) {
            const queriedId = track.playableVideoId || track.videoId;
            const info = results[queriedId];
            if (info) {
              await updateTrackMetadata(playlist.id, track.id, buildTrackUpdates(track, info));
            }
          }
        } catch (error) {
          // Sin key en el servidor, cuota agotada, red caída, etc.
          // Detener la cascada para no saturar.
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
 * Consulta la información completa de un único video (estado + metadata) vía
 * el proxy del servidor. Usado al agregar una canción manualmente.
 * @param {string} videoId
 * @returns {Promise<{status: string, message: string|null, snippet: object, durationSeconds: number|null}|null>}
 */
export const fetchVideoInfo = async (videoId) => {
  if (!videoId) return null;
  try {
    const results = await fetchVideoStatus([videoId]);
    return results[videoId] || null;
  } catch {
    // Sin key en el servidor o error de red: el alta manual sigue sin metadata.
    return null;
  }
};

/**
 * Verifica un único track (usado tras reparar un link) y persiste el resultado.
 * @param {string} playlistId
 * @param {import('../types/player.js').Track} track
 */
export const checkTrackNow = async (playlistId, track) => {
  if (!track?.videoId) return;
  try {
    // Igual que el barrido: se verifica la copia reproducible (si existe), no el
    // ancla original — reparar un track con embed bloqueado no debe volver a
    // marcarlo como aviso en el acto.
    const queriedId = track.playableVideoId || track.videoId;
    const results = await fetchVideoStatus([queriedId]);
    const info = results[queriedId];
    if (info) {
      await updateTrackMetadata(playlistId, track.id, buildTrackUpdates(track, info));
    }
    if (playerState.currentTrack.value?.id === track.id) {
      playerState.currentTrack.value = { ...playerState.currentTrack.value, status: info?.status || 'unchecked', statusMessage: info?.message || null };
    }
  } catch (error) {
    console.error('[LinkChecker] No se pudo verificar el track:', error);
  }
};
import { signal } from '@preact/signals';
import { playerState } from '../state/playerState.js';
import { playlistState } from '../state/playlistState.js';
import { updateTrackMetadata } from '../state/playlistCrud.js';
import { settingsState } from '../state/settingsState.js';
import {
  buildTrackUpdates,
  needsCheck,
  parseISO8601Duration
} from './linkStatus.js';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
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
import { signal } from '@preact/signals';
import { playerState } from '../state/playerState.js';
import { playlistState, updateTrackMetadata } from '../state/playlistState.js';
import { settingsState } from '../state/settingsState.js';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 50;
const AUTO_INTERVAL_MS = 60 * 1000;
const MANUAL_INTERVAL_MS = 5 * 1000;
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export const linkCheckerState = {
  isRunning: signal(false)
};

let isRunning = false;
let shouldStop = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Decidir si un track necesita verificación (nunca verificado, en warning, o con chequeo viejo).
 */
const needsCheck = (track) =>
  track.status === 'unchecked' ||
  track.status === 'warning' ||
  !track.lastCheckedAt ||
  Date.now() - track.lastCheckedAt > STALE_THRESHOLD_MS;

/**
 * Consulta el estado de un lote de videos y devuelve un mapa videoId -> { status, message }.
 * Videos que ya no existen en YouTube no aparecen en la respuesta => se marcan como rotos.
 * @param {string[]} videoIds
 * @param {string} apiKey
 */
const fetchVideoStatus = async (videoIds, apiKey) => {
  const res = await fetch(`${BASE_URL}/videos?part=status&id=${videoIds.join(',')}&key=${apiKey}`);
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
    if (st.uploadStatus === 'rejected' || st.uploadStatus === 'failed') {
      statuses[item.id] = { status: 'broken', message: `Video ${st.uploadStatus}` };
    } else if (st.privacyStatus === 'private') {
      statuses[item.id] = { status: 'warning', message: 'Video privado' };
    } else if (st.embeddable === false) {
      statuses[item.id] = { status: 'warning', message: 'Reproducción embebida bloqueada' };
    } else {
      statuses[item.id] = { status: 'healthy', message: null };
    }
  }
  return statuses;
};

/**
 * Verifica las playlists en cascada una sola vez por sesión:
 * - un lote de BATCH_SIZE (50) videos por request
 * - automatático: 1 lote por minuto (no molesta, respeta la cuota de la API)
 * - manual: 1 lote cada 5 segundos
 * Solo revisa tracks no verificados, en warning, o con chequeo viejo (+7 días),
 * así el barrido de cada sesión es ligero y no repite trabajo ya hecho.
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
              await updateTrackMetadata(playlist.id, track.id, {
                status: info.status,
                statusMessage: info.message,
                lastCheckedAt: Date.now()
              });
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
    await updateTrackMetadata(playlistId, track.id, {
      status: info.status,
      statusMessage: info.message,
      lastCheckedAt: Date.now()
    });
  }
  if (playerState.currentTrack.value?.id === track.id) {
    playerState.currentTrack.value = { ...playerState.currentTrack.value, status: info?.status || 'unchecked', statusMessage: info?.message || null };
  }
};
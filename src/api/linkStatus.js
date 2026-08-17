/**
 * Política de retención (Developer Policies III.E.4): ningún dato de la API
 * puede superar 30 días sin refrescarse. Como el barrido re-chequea como máximo
 * 1 vez al día, cuando un link se rompe su metadata tiene <=1 día de antigüedad,
 * así que la ventana de recuperación de 23 días es conservadora desde la detección.
 */
export const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const RECOVERY_WINDOW_MS = 23 * 24 * 60 * 60 * 1000;

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

/** Track roto cuyo plazo de recuperación venció y aún conserva metadata de la API. */
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
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const needsCheck = (track) => {
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

/**
 * Construye las actualizaciones para un track a partir del resultado del checker:
 * - Videos vivos: refresca la metadata de la API (fecha, miniatura, duración)
 *   para mantenerla siempre dentro de la ventana de 30 días. NUNCA pisa el
 *   título/artista editados por el usuario.
 * - Links rotos: registra `brokenAt`; si la ventana de recuperación venció,
 *   purga la metadata de la API (se conservan videoId, título y artista).
 * @param {import('../types/player.js').Track} track
 * @param {{status: string, message: string|null, snippet?: object, durationSeconds?: number|null}} info
 * @param {number} [now]
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
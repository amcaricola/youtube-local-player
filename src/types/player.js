/**
 * Modelos de datos de la aplicación.
 *
 * Política de retención (YouTube API Services - Developer Policies III.E.4):
 * - Los datos de la API (miniatura, fecha de publicación, duración) se conservan
 *   como máximo 30 días sin refrescarse; el link checker los renueva en cada
 *   barrido y los purga cuando un link roto supera su ventana de recuperación.
 * - `title` y `artist` son datos del usuario: se parsean desde la API al importar
 *   y el usuario puede editarlos libremente. Se conservan siempre.
 * - `videoId` es solo un identificador/enlace al recurso en YouTube y se conserva
 *   para mantener la conexión canción <-> video y permitir reparaciones.
 * - `originalTitle` y `channelTitle` NO se persisten: se usan en memoria durante
 *   el parseo y se descartan.
 */

/**
 * @typedef {Object} Track
 * @property {string} id - Identificador interno (por defecto, el YouTube Video ID)
 * @property {string} videoId - YouTube Video ID (e.g. "dQw4w9WgXcQ"); enlace al recurso
 * @property {string} title - Título de la canción (parseado; editable por el usuario)
 * @property {string} artist - Artista (parseado; editable por el usuario)
 * @property {string} thumbnailUrl - URL de la miniatura en YouTube (API data; purgable)
 * @property {string|null} publishedAt - Fecha de publicación ISO 8601 (API data; purgable)
 * @property {number|null} durationSeconds - Duración en segundos (API data; purgable)
 * @property {'healthy'|'warning'|'broken'|'unchecked'} status - Salud del link
 * @property {string|null} statusMessage - Motivo si warning/broken
 * @property {number|null} brokenAt - Timestamp en que se detectó el link roto (null si no aplica)
 * @property {number} metadataFetchedAt - Timestamp del último refresh exitoso de API data (0 = pendiente)
 * @property {boolean} [removedFromSource] - Ya no está en la playlist original de YouTube
 * @property {number} addedAt - Timestamp de alta
 * @property {number|null} lastCheckedAt - Timestamp de la última verificación de integridad
 */

/**
 * @typedef {Object} Playlist
 * @property {string} id - ID único de la playlist
 * @property {string|null} youtubePlaylistId - ID de la playlist de YouTube (si está sincronizada)
 * @property {string} title - Nombre de la playlist
 * @property {string} description - Descripción
 * @property {string} [thumbnail] - Miniatura de la playlist
 * @property {Array<Track>} tracks - Canciones en orden
 * @property {number} createdAt - Timestamp de creación
 * @property {number} updatedAt - Timestamp de última edición
 */

export {};

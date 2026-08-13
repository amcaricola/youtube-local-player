/**
 * Intenta extraer el artista y el título de la canción a partir del título del video de YouTube.
 * Formatos soportados:
 *   "Artista - Canción (Official Video)" -> Artist: "Artista", Title: "Canción"
 *   "Canción ft. Feature - Artista"      -> Artist: "Artista", Title: "Canción ft. Feature"
 *   "Canción" (canal "- Topic"/"VEVO")   -> Artist: canal limpio, Title: "Canción"
 *
 * @param {string} originalTitle El título del video en YouTube
 * @param {string} channelTitle El nombre del canal (como respaldo para el artista)
 * @returns {{ artist: string, title: string }}
 */
export const parseTrackMetadata = (originalTitle, channelTitle) => {
  let title = (originalTitle || '').trim();
  let artist = (channelTitle || '').trim();

  // Etiquetas comunes al inicio/final de los títulos oficiales
  const cleanUpRegex = /\s*(\(|\[)\s*(official\s+(music\s+|lyric\s+)?(video|audio)|official\s+hd\s+video|official\s+clip|lyric\s+video|lyrics|visualizer|music\s+video|video\s+oficial|audio\s+oficial|oficial)\s*(\)|\])/i;
  title = title.replace(cleanUpRegex, '').trim();

  // Separadores: guion simple, en dash o em dash rodeados de espacios
  const splitRegex = /^(.*?)\s*[-\u2013\u2014]\s*(.*?)$/;

  // A veces agregan cosas después de un separador como | o //
  const partsByPipe = title.split(/\s*\|\s*/);
  const mainPart = partsByPipe[0].trim();

  const ftRegex = /\b(feat\.?|ft\.?|featuring)\b/i;
  const match = mainPart.match(splitRegex);

  if (match && match.length >= 3) {
    const left = match[1].trim();
    const right = match[2].trim();

    const leftQuoted = /^["'].*["']$/.test(left);

    if (leftQuoted || ftRegex.test(left)) {
      // "Canción ft. Feature - Artista" o '"Canción" - Artista' => el artista está a la derecha
      artist = right;
      title = left;
    } else {
      artist = left;
      title = right;
    }

    // Limpiar etiquetas sobrantes en ambos lados
    title = title.replace(cleanUpRegex, '').trim();
    artist = artist.replace(cleanUpRegex, '').trim();
  } else {
    // Sin guión separador: el título completo es la canción y el canal es el artista
    title = mainPart;
    if (/ - Topic$/i.test(artist)) {
      artist = artist.replace(/ - Topic$/i, '').trim();
    } else if (/VEVO$/i.test(artist)) {
      artist = artist.replace(/VEVO$/i, '').trim();
    } else if (/Official Artist Channel$/i.test(artist)) {
      artist = artist.replace(/Official Artist Channel$/i, '').trim();
    }
  }

  // Pequeña corrección si las comillas agruparon la canción
  title = title.replace(/^["'](.*)["']$/, '$1').trim();

  return { artist, title };
};

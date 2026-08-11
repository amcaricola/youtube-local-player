/**
 * Intenta extraer el artista y el título de la canción a partir del título del video de YouTube.
 * Muchos videos musicales oficiales siguen el formato: "Artista - Título de la canción (Official Video)"
 * 
 * @param {string} originalTitle El título del video en YouTube
 * @param {string} channelTitle El nombre del canal (como respaldo para el artista)
 * @returns {{ artist: string, title: string }}
 */
export const parseTrackMetadata = (originalTitle, channelTitle) => {
  let title = originalTitle;
  let artist = channelTitle;

  // Limpiar etiquetas comunes al final del título
  const cleanUpRegex = /\s*(\(|\[)(official video|official audio|lyric video|lyrics|video oficial|audio oficial)(\)|\])/i;
  title = title.replace(cleanUpRegex, '').trim();

  // Buscar el patrón "Artista - Canción" o "Artista - Canción | Algo"
  const splitRegex = /^(.*?)\s*-\s*(.*?)$/;
  
  // A veces agregan cosas después de un separador como | o //
  const partsByPipe = title.split(/\s*\|\s*/);
  const mainPart = partsByPipe[0];

  const match = mainPart.match(splitRegex);
  
  if (match && match.length >= 3) {
    // Si encuentra el guión separador
    artist = match[1].trim();
    title = match[2].trim();
    
    // Quitar "(Official Music Video)" si quedó en el título extraído
    title = title.replace(cleanUpRegex, '').trim();
  } else {
    // Si no hay guión, asumimos que el título completo es la canción 
    // y el canal es el artista (a menos que termine en - Topic)
    title = mainPart.trim();
    if (artist.endsWith(' - Topic')) {
      artist = artist.replace(' - Topic', '').trim();
    } else if (artist.endsWith('VEVO')) {
      artist = artist.replace('VEVO', '').trim();
    }
  }

  // Pequeña corrección si las comillas agruparon la canción
  title = title.replace(/^["'](.*)["']$/, '$1');

  return { artist, title };
};

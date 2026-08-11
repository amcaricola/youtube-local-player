import { settingsState } from '../state/settingsState.js';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Valida que la API Key de YouTube sea correcta haciendo una petición mínima.
 * @param {string} apiKey 
 * @returns {Promise<boolean>}
 */
export const checkApiKey = async (apiKey) => {
  try {
    const res = await fetch(`${BASE_URL}/videos?part=snippet&id=dQw4w9WgXcQ&key=${apiKey}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message || 'API Key Error');
    }
    return true;
  } catch (error) {
    console.error("YouTube API Error:", error);
    return false;
  }
};

/**
 * Extrae el ID de la playlist desde una URL de YouTube
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
 * Obtiene toda la información y videos de una playlist.
 * @param {string} playlistId 
 * @param {string} apiKey 
 * @returns {Promise<import('../types/player.js').Playlist>}
 */
export const fetchPlaylistData = async (playlistId, apiKey) => {
  if (!apiKey) throw new Error("API Key requerida");

  // 1. Obtener metadatos de la playlist
  const metaRes = await fetch(`${BASE_URL}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`);
  const metaData = await metaRes.json();
  
  if (metaData.error) throw new Error(metaData.error.message);
  if (!metaData.items || metaData.items.length === 0) throw new Error("Playlist no encontrada o es privada");

  const playlistSnippet = metaData.items[0].snippet;
  
  // 2. Obtener todos los videos de la playlist (manejando paginación)
  let items = [];
  let nextPageToken = '';
  
  do {
    const itemsRes = await fetch(`${BASE_URL}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`);
    const itemsData = await itemsRes.json();
    
    if (itemsData.error) throw new Error(itemsData.error.message);
    
    items = [...items, ...itemsData.items];
    nextPageToken = itemsData.nextPageToken;
  } while (nextPageToken);

  // 3. Importar y formatear (El parser de metadatos se llamará desde el manejador de estado)
  return {
    youtubePlaylistId: playlistId,
    title: playlistSnippet.title,
    description: playlistSnippet.description,
    thumbnail: playlistSnippet.thumbnails?.medium?.url || '',
    rawItems: items
  };
};

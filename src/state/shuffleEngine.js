import { effect } from '@preact/signals';
import { playlistState, filteredTracks } from './playlistState.js';
import { playerState } from './playerState.js';

/**
 * Motor de shuffle propio (Fisher-Yates con historial): la cola mantiene los
 * ids de todas las canciones sin repetir hasta agotar el ciclo. El shuffle
 * siempre opera sobre la lista FILTRADA completa, no sobre las filas visibles.
 */

/** Fisher-Yates sobre los ids; opcionalmente excluye la canción actual. */
export const generateShuffle = (tracks, excludeTrackId = null) => {
  let queue = tracks.map(t => t.id);
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (excludeTrackId) {
    queue = queue.filter(id => id !== excludeTrackId);
  }
  return queue;
};

export const toggleShuffle = () => {
  playlistState.isShuffle.value = !playlistState.isShuffle.value;
  if (playlistState.isShuffle.value) {
    const current = playerState.currentTrack.value;
    playlistState.shuffledQueue.value = generateShuffle(filteredTracks.value, current?.id);
    playlistState.playedHistory.value = current ? [current.id] : [];
  } else {
    playlistState.shuffledQueue.value = [];
  }
};

export const cycleRepeatMode = () => {
  const modes = ['off', 'all', 'one'];
  const current = playlistState.repeatMode.value;
  const next = modes[(modes.indexOf(current) + 1) % modes.length];
  playlistState.repeatMode.value = next;
};

// Cuando el filtro de búsqueda cambia con shuffle activo, regenera la cola
// para que el shuffle solo reproduzca canciones de la lista filtrada actual.
effect(() => {
  filteredTracks.value;
  if (playlistState.isShuffle.value) {
    const current = playerState.currentTrack.value;
    playlistState.shuffledQueue.value = generateShuffle(filteredTracks.value, current?.id);
    playlistState.playedHistory.value = current ? [current.id] : [];
  }
});
import { playlistState, filteredTracks } from './playlistState.js';
import { playerState } from './playerState.js';
import { generateShuffle } from './shuffleEngine.js';

/**
 * Reproduce la siguiente canción de la lista activa (respetando shuffle y
 * modo de repetición). La cola shuffle se importa dinámicamente solo al
 * reproducir para no cargar el reproductor de YouTube al arrancar.
 */
export const playNextTrack = () => {
  const active = playlistState.activePlaylist.value;
  const current = playerState.currentTrack.value;
  if (!active) return;

  const tracks = filteredTracks.value;
  if (tracks.length === 0) return;

  import('../api/iframePlayer.js').then(({ playTrack }) => {
    if (playlistState.isShuffle.value) {
      let queue = [...playlistState.shuffledQueue.value];
      if (queue.length === 0) {
        // La cola se agotó: solo se vuelve a llenar si el modo lo permite
        if (playlistState.repeatMode.value === 'off') return;
        playlistState.shuffledQueue.value = generateShuffle(tracks, current?.id);
        playlistState.playedHistory.value = [];
        queue = [...playlistState.shuffledQueue.value];
      }
      let nextId = queue.shift();
      // Saltar IDs duplicados del video recién terminado para evitar un loop ENDED->loadVideoById
      while (nextId && current && nextId === current.id) {
        nextId = queue.shift();
      }
      playlistState.shuffledQueue.value = queue;

      const nextTrack = tracks.find(t => t.id === nextId);
      if (nextTrack) {
        if (current) {
          playlistState.playedHistory.value = [...playlistState.playedHistory.value, current.id];
        }
        playTrack(nextTrack);
      }
    } else {
      if (!current) {
        playTrack(tracks[0]);
        return;
      }
      const currentIndex = tracks.findIndex(t => t.id === current.id);
      if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
        playTrack(tracks[currentIndex + 1]);
      } else if (playlistState.repeatMode.value === 'all') {
        // Loop back to start
        playTrack(tracks[0]);
      }
    }
  });
};

/**
 * Reproduce la canción anterior de la lista activa. Si lleva más de 3
 * segundos reproducida, reinicia la canción actual en su lugar.
 */
export const playPrevTrack = () => {
  const active = playlistState.activePlaylist.value;
  const current = playerState.currentTrack.value;
  if (!active || !current) return;

  // Si lleva más de 3 segundos, reiniciar la canción actual
  if (playerState.currentTime.value > 3) {
    import('../api/iframePlayer.js').then(({ seekTo }) => {
      seekTo(0);
    });
    return;
  }

  const tracks = filteredTracks.value;

  import('../api/iframePlayer.js').then(({ playTrack }) => {
    if (playlistState.isShuffle.value) {
      if (playlistState.playedHistory.value.length > 0) {
        const history = [...playlistState.playedHistory.value];
        const prevId = history.pop();
        playlistState.playedHistory.value = history;

        playlistState.shuffledQueue.value = [current.id, ...playlistState.shuffledQueue.value];
        const prevTrack = tracks.find(t => t.id === prevId);
        if (prevTrack) playTrack(prevTrack);
      } else {
        import('../api/iframePlayer.js').then(({ seekTo }) => seekTo(0));
      }
    } else {
      const currentIndex = tracks.findIndex(t => t.id === current.id);
      if (currentIndex > 0) {
        playTrack(tracks[currentIndex - 1]);
      } else {
        playTrack(tracks[tracks.length - 1]);
      }
    }
  });
};
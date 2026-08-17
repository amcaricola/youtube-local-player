import { playerState } from '../state/playerState.js';

/**
 * Handlers de eventos del reproductor de YouTube IFrame. No conocen el
 * módulo `player` directamente: usan `event.target` (la instancia que YouTube
 * entrega en cada evento) o la instancia registrada con `setActivePlayer`.
 * La vida del reproductor (init, play, seek, volumen) vive en `iframePlayer.js`.
 */

let activePlayer = null;
let progressInterval = null;

/** Registra la instancia activa del reproductor (llamado desde el onReady). */
export const setActivePlayer = (player) => {
  activePlayer = player;
};

function updateProgress() {
  if (activePlayer && playerState.isPlaying.value && activePlayer.getCurrentTime) {
    playerState.currentTime.value = activePlayer.getCurrentTime();
  }
}

export function onPlayerReady(resolve) {
  return (event) => {
    const player = event.target;
    setActivePlayer(player);
    playerState.isReady.value = true;
    playerState.errorMessage.value = '';
    player.setVolume(playerState.volume.value);

    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(updateProgress, 500);
    resolve();
  };
}

export function onPlayerStateChange(event) {
  if (!window.YT) return;
  const player = event.target;
  // Estados: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
  if (event.data === window.YT.PlayerState.PLAYING) {
    playerState.isPlaying.value = true;
    playerState.isBuffering.value = false;
    if (player.getDuration) {
      playerState.duration.value = player.getDuration();
    }
  } else if (event.data === window.YT.PlayerState.PAUSED) {
    playerState.isPlaying.value = false;
    playerState.isBuffering.value = false;
  } else if (event.data === window.YT.PlayerState.ENDED) {
    playerState.isPlaying.value = false;
    playerState.isBuffering.value = false;
    playerState.trackEndedFlag.value++;
  } else if (event.data === window.YT.PlayerState.CUED) {
    // A veces YouTube encola el video pero no lo reproduce automáticamente.
    // Forzamos el play si llega a este estado.
    player.playVideo();
  } else if (event.data === window.YT.PlayerState.BUFFERING) {
    playerState.isBuffering.value = true;
  }
}

export function onPlayerError(event) {
  // Errores comunes:
  // 2 (parámetro inválido), 5 (HTML5 error), 100 (no encontrado/eliminado)
  // 101/150 (propietario bloqueó su reproducción en iframes)
  playerState.isPlaying.value = false;
  playerState.isBuffering.value = false;

  const current = playerState.currentTrack.value;
  if (current) {
    const broke = event.data === 100 || event.data === 2;
    const message = broke
      ? 'Video eliminado o no disponible'
      : event.data === 101 || event.data === 150
        ? 'El propietario bloqueó la reproducción embebida'
        : event.data === 5
          ? 'El reproductor HTML5 no pudo cargar este video'
          : `Error del reproductor (${event.data})`;
    const status = broke ? 'broken' : 'warning';
    // Marcar el estado del track sin detener el flujo
    Promise.all([
      import('../state/playlistState.js'),
      import('../state/playlistCrud.js')
    ]).then(async ([{ playlistState }, { updateTrackMetadata }]) => {
      const active = playlistState.activePlaylist.value;
      if (active) {
        await updateTrackMetadata(active.id, current.id, {
          status,
          statusMessage: message,
          lastCheckedAt: Date.now()
        });
      }
    });
  }

  playerState.errorMessage.value = current
    ? 'No se pudo reproducir este video. Revisa el estado del link o busca un reemplazo.'
    : `YouTube devolvió un error (${event.data}).`;
}
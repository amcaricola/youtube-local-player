import { playerState } from '../state/playerState.js';
import { onPlayerReady, onPlayerStateChange, onPlayerError } from './playerEvents.js';

/**
 * Wrapper de la YouTube IFrame Player API: inicialización, reproducción,
 * control de volumen y pantalla completa. Los handlers de eventos del
 * reproductor viven en `playerEvents.js`.
 */

let player = null;
let previousVolume = playerState.volume.value || 100;

export const initYouTubePlayer = () => {
  return new Promise((resolve) => {
    if (player) {
      resolve();
      return;
    }

    // Contenedor fuera de la vista pero con dimensiones reales.
    // YouTube bloquea reproductores de 1x1 o invisibles por política de autoplay.
    let container = document.getElementById('yt-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-player-container';
      container.style.position = 'fixed';
      container.style.top = '-2000px';
      container.style.left = '-2000px';
      container.style.width = '400px';
      container.style.height = '300px';
      container.style.zIndex = '-9999';
      document.body.appendChild(container);
    }

    const loadPlayer = () => {
      player = new window.YT.Player('yt-player-container', {
        height: '300',
        width: '400',
        videoId: '',
        playerVars: {
          'playsinline': 1,
          'controls': 1,
          'disablekb': 0,
          'fs': 1,
          'iv_load_policy': 3,
          'cc_load_policy': 0,
          'rel': 0,
          'origin': window.location.origin // Esencial para evitar bloqueos de origen en localhost
        },
        events: {
          'onReady': onPlayerReady(resolve),
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    };

    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);

      // YouTube llama a esta función global cuando su script está listo
      window.onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }
  });
};

export const playTrack = (track) => {
  if (!player) {
    console.warn("[YT Player] Intento de reproducción, pero el player no está instanciado.");
    return;
  }

  if (track && track.videoId) {
    playerState.currentTrack.value = track;
    playerState.errorMessage.value = '';
    playerState.isBuffering.value = true;

    // Resetear el progreso al cargar una canción nueva para que la barra
    // no muestre el tiempo/progreso de la canción anterior
    playerState.currentTime.value = 0;
    playerState.duration.value = 0;

    player.loadVideoById(track.videoId);

    // Forzamos la reproducción por si la API falla en el autoplay implícito
    setTimeout(() => {
      if (player && player.playVideo) {
        player.playVideo();
        playerState.isPlaying.value = true;
      }
    }, 200);
  }
};

export const togglePlay = () => {
  if (!player || !playerState.currentTrack.value) return;
  if (playerState.isPlaying.value) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
};

export const setVolume = (vol) => {
  if (player && player.setVolume) {
    if (vol > 0) previousVolume = vol;
    player.setVolume(vol);
    playerState.volume.value = vol;
    playerState.isMuted.value = vol === 0;
  }
};

export const toggleMute = () => {
  if (playerState.isMuted.value || playerState.volume.value === 0) {
    setVolume(previousVolume || 100);
  } else {
    previousVolume = playerState.volume.value;
    setVolume(0);
  }
};

export const toggleFullscreen = async (fullscreenContainer = null) => {
  const iframe = player?.getIframe?.();
  const target = fullscreenContainer || document.getElementById('yt-player-shell') || iframe;
  if (!target) return;

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (target.requestFullscreen) {
      await target.requestFullscreen();
    }
  } catch (error) {
    console.warn('[YT Player] No se pudo activar pantalla completa:', error);
  }
};

export const seekTo = (seconds) => {
  if (player && player.seekTo) {
    player.seekTo(seconds, true);
    playerState.currentTime.value = seconds;
  }
};

export const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
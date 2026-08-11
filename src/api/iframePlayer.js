import { playerState } from '../state/playerState.js';

let player = null;
let progressInterval = null;

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
      console.log("[YT Player] Inicializando API de IFrame...");
      player = new window.YT.Player('yt-player-container', {
        height: '300',
        width: '400',
        videoId: '',
        playerVars: {
          'playsinline': 1,
          'controls': 0,
          'disablekb': 1,
          'fs': 0,
          'rel': 0,
          'modestbranding': 1,
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
      console.log("[YT Player] Inyectando script de YouTube...");
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

function onPlayerReady(resolve) {
  return (event) => {
    console.log("[YT Player] Listo para recibir comandos.");
    playerState.isReady.value = true;
    player.setVolume(playerState.volume.value);
    
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(updateProgress, 500);
    resolve();
  };
}

function onPlayerStateChange(event) {
  if (!window.YT) return;
  console.log("[YT Player] Cambio de Estado:", event.data);
  // Estados: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
  
  if (event.data === window.YT.PlayerState.PLAYING) {
    playerState.isPlaying.value = true;
    if (player.getDuration) {
      playerState.duration.value = player.getDuration();
    }
  } else if (event.data === window.YT.PlayerState.PAUSED) {
    playerState.isPlaying.value = false;
  } else if (event.data === window.YT.PlayerState.ENDED) {
    playerState.isPlaying.value = false;
    playerState.trackEndedFlag.value++;
  } else if (event.data === window.YT.PlayerState.CUED) {
    // A veces YouTube encola el video pero no lo reproduce automáticamente.
    // Forzamos el play si llega a este estado.
    player.playVideo();
  }
}

function onPlayerError(event) {
  console.error("[YT Player] Error en el reproductor:", event.data);
  // Errores comunes: 
  // 2 (parámetro inválido), 5 (HTML5 error), 100 (no encontrado/eliminado)
  // 101/150 (propietario bloqueó su reproducción en iframes)
  playerState.isPlaying.value = false;
  alert("El video de YouTube arrojó un error o no permite ser reproducido fuera de su página web (Error " + event.data + ").");
}

function updateProgress() {
  if (player && playerState.isPlaying.value && player.getCurrentTime) {
    playerState.currentTime.value = player.getCurrentTime();
  }
}

export const playTrack = (track) => {
  if (!player) {
    console.warn("[YT Player] Intento de reproducción, pero el player no está instanciado.");
    return;
  }
  
  if (track && track.videoId) {
    console.log("[YT Player] Cargando track:", track.videoId);
    playerState.currentTrack.value = track;
    
    // Usamos loadVideoById para cargar y reproducir
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
    player.setVolume(vol);
    playerState.volume.value = vol;
    if (vol > 0) playerState.isMuted.value = false;
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

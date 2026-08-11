import { useEffect, useRef } from 'preact/hooks';
import { playerState, progressPercent } from '../../state/playerState.js';
import { playlistState } from '../../state/playlistState.js';
import { togglePlay, setVolume, seekTo, formatTime } from '../../api/iframePlayer.js';

export function PlayerBar() {
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);

  const handleSeek = (e) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * playerState.duration.value);
  };

  const handleVolumeChange = (e) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    setVolume(percent * 100);
  };

  const currentTrack = playerState.currentTrack.value;
  const isPlaying = playerState.isPlaying.value;

  return (
    <footer class="h-20 glass-dark shrink-0 flex items-center justify-between px-6 z-20 transition-all">
      {/* Track Info */}
      <div class="flex items-center gap-4 w-1/3">
        <div class="w-12 h-12 bg-gray-800 rounded-md overflow-hidden relative shadow-md">
          {currentTrack?.thumbnailUrl ? (
            <img src={currentTrack.thumbnailUrl} alt="Thumbnail" class="w-full h-full object-cover" />
          ) : (
            <div class="w-full h-full flex items-center justify-center text-gray-500">
               <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
            </div>
          )}
        </div>
        <div class="truncate">
          <div class="text-sm font-semibold text-gray-100 truncate">
            {currentTrack?.title || "Sin Canción"}
          </div>
          <div class="text-xs text-gray-400 truncate">
            {currentTrack?.artist || "Desconocido"}
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div class="flex flex-col items-center w-1/3">
        <div class="flex items-center gap-6 mb-2">
          
          <button onClick={() => {
              import('../../state/playlistState.js').then(({ toggleShuffle }) => toggleShuffle());
            }} 
            class={`transition-colors ${playlistState.isShuffle.value ? 'text-blue-500 hover:text-blue-400' : 'text-gray-500 hover:text-white'}`} 
            title="Aleatorio (Shuffle)">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"></path></svg>
          </button>

          <button onClick={() => {
              import('../../state/playlistState.js').then(({ playPrevTrack }) => playPrevTrack());
            }} 
            class="text-gray-400 hover:text-white transition-colors" title="Anterior">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg>
          </button>
          
          <button 
            onClick={() => {
              const currentTrack = playerState.currentTrack.value;
              if (!currentTrack) {
                import('../../state/playlistState.js').then(({ playlistState }) => {
                  const active = playlistState.activePlaylist.value;
                  if (active && active.tracks.length > 0) {
                    import('../../api/iframePlayer.js').then(({ playTrack }) => playTrack(active.tracks[0]));
                  }
                });
              } else {
                togglePlay();
              }
            }}
            class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
            title={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? (
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
            ) : (
              <svg class="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
            )}
          </button>
          
          <button onClick={() => {
              import('../../state/playlistState.js').then(({ playNextTrack }) => playNextTrack());
            }} 
            class="text-gray-400 hover:text-white transition-colors" title="Siguiente">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg>
          </button>
        </div>
        
        {/* Progress Bar */}
        <div class="w-full max-w-md flex items-center gap-3">
          <span class="text-[10px] text-gray-400 font-medium w-8 text-right">
            {formatTime(playerState.currentTime.value)}
          </span>
          <div 
            ref={progressBarRef}
            class="h-1.5 flex-1 bg-gray-700/50 rounded-full overflow-hidden cursor-pointer group relative"
            onClick={handleSeek}
          >
            <div 
              class="h-full bg-gradient-to-r from-red-500 to-red-400 group-hover:from-red-400 group-hover:to-red-300 transition-all relative"
              style={{ width: `${progressPercent.value}%` }}
            >
              <div class="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-sm"></div>
            </div>
          </div>
          <span class="text-[10px] text-gray-400 font-medium w-8">
            {formatTime(playerState.duration.value)}
          </span>
        </div>
      </div>
      
      {/* Volume Controls */}
      <div class="w-1/3 flex justify-end items-center gap-3">
        <button 
          onClick={() => setVolume(playerState.volume.value > 0 ? 0 : 100)}
          class="text-gray-400 hover:text-white transition-colors"
        >
          {playerState.volume.value === 0 ? (
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>
          ) : (
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
          )}
        </button>
        <div 
          ref={volumeBarRef}
          class="w-24 h-1.5 bg-gray-700/50 rounded-full overflow-hidden cursor-pointer group"
          onClick={handleVolumeChange}
        >
          <div 
            class="h-full bg-white group-hover:bg-gray-200 transition-all relative"
            style={{ width: `${playerState.volume.value}%` }}
          ></div>
        </div>
      </div>
    </footer>
  );
}

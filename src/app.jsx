import { useEffect, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import { PlayerBar } from './components/player/PlayerBar.jsx';
import { SettingsModal } from './components/settings/SettingsModal.jsx';
import { TrackEditModal } from './components/playlist/TrackEditModal.jsx';
import { TrackRepairModal } from './components/playlist/TrackRepairModal.jsx';
import { StatusBadge } from './components/common/StatusBadge.jsx';
import { runCascadingLinkCheck } from './api/linkChecker.js';
import { initYouTubePlayer, playTrack, togglePlay, toggleMute, setVolume, seekTo } from './api/iframePlayer.js';
import { extractPlaylistId } from './api/youtubeApi.js';
import { playerState } from './state/playerState.js';
import { settingsState } from './state/settingsState.js';
import { playlistState, loadLocalPlaylists, importYouTubePlaylist, syncAllPlaylists, playNextTrack, filteredTracks, problemCounts, toggleSort } from './state/playlistState.js';

// Auto-play siguiente canción cuando termine
effect(() => {
  if (playerState.trackEndedFlag.value > 0) {
    // Resetear el flag ANTES de avanzar: si YouTube dispara ENDED
    // varias veces seguidas, solo avanzamos una canción.
    playerState.trackEndedFlag.value = 0;
    if (playlistState.repeatMode.value === 'one') {
      const current = playerState.currentTrack.value;
      if (current && current.videoId) {
        playTrack(current);
        return;
      }
    }
    playNextTrack();
  }
});

export function App() {
  const [importUrl, setImportUrl] = useState('');
  const [artistInput, setArtistInput] = useState('');

  const addArtistFilterValue = (value) => {
    const artist = value.trim();
    if (!artist) return;
    const exists = playlistState.artistFilters.value.some(item => item.toLowerCase() === artist.toLowerCase());
    if (!exists) {
      playlistState.artistFilters.value = [...playlistState.artistFilters.value, artist];
    }
    setArtistInput('');
  };

  const addArtistFilter = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addArtistFilterValue(artistInput);
  };

  const removeArtistFilter = (artist) => {
    playlistState.artistFilters.value = playlistState.artistFilters.value.filter(item => item !== artist);
  };

  useEffect(() => {
    loadLocalPlaylists().then(async () => {
      if (settingsState.autoSyncPlaylists.value) {
        const results = await syncAllPlaylists();
        const total = results.reduce((acc, r) => ({ added: acc.added + r.added, removed: acc.removed + r.removed }), { added: 0, removed: 0 });
        if (total.added > 0 || total.removed > 0) {
          playlistState.syncNotice.value = `Sincronizado: +${total.added} nuevas, ${total.removed} eliminadas de YouTube`;
          setTimeout(() => { playlistState.syncNotice.value = null; }, 6000);
        }
      }
      runCascadingLinkCheck();
    });
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      );
      const modalOpen = settingsState.isSettingsOpen.value ||
        playlistState.editingTrack.value ||
        playlistState.repairTrack.value;

      if (isTyping || modalOpen) return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!playerState.currentTrack.value) return;
        event.preventDefault();
        const amount = event.key === 'ArrowLeft' ? -5 : 5;
        const nextTime = Math.max(0, Math.min(
          playerState.duration.value || Infinity,
          playerState.currentTime.value + amount
        ));
        seekTo(nextTime);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const amount = event.key === 'ArrowUp' ? 5 : -5;
        setVolume(Math.max(0, Math.min(100, playerState.volume.value + amount)));
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleImport = async () => {
    const playlistId = extractPlaylistId(importUrl);
    if (!playlistId) {
      alert("No se pudo extraer el ID de la Playlist. Usa un link válido como https://www.youtube.com/playlist?list=...");
      return;
    }
    if (!settingsState.apiKey.value) {
      alert("Por favor, configura tu API Key en los Ajustes primero.");
      settingsState.isSettingsOpen.value = true;
      return;
    }
    
    await importYouTubePlaylist(playlistId, settingsState.apiKey.value);
    setImportUrl('');
    runCascadingLinkCheck();
  };

  const activePlaylist = playlistState.activePlaylist.value;

  useEffect(() => {
    if (activePlaylist) initYouTubePlayer();
  }, [activePlaylist?.id]);

  const selectedArtists = new Set(playlistState.artistFilters.value.map(artist => artist.toLowerCase()));
  const artistSearch = artistInput.trim().toLowerCase();
  const uniqueArtists = [...new Map(
    (activePlaylist?.tracks || [])
      .map(track => track.artist?.trim())
      .filter(Boolean)
      .map(artist => [artist.toLowerCase(), artist])
  ).values()]
    .filter(artist => !selectedArtists.has(artist.toLowerCase()))
    .sort((a, b) => {
      const aMatches = artistSearch && a.toLowerCase().includes(artistSearch);
      const bMatches = artistSearch && b.toLowerCase().includes(artistSearch);
      return Number(bMatches) - Number(aMatches) || a.localeCompare(b);
    })
    .slice(0, 3);
  const visibleTracks = filteredTracks.value.slice(0, playlistState.visibleLimit.value);
  const counts = problemCounts.value;
  const totalProblems = counts.broken + counts.warning;

  const formatUploadDate = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString();
  };

  return (
    <div class="h-screen w-full flex flex-col bg-gray-900 text-gray-100">
      <header class="h-16 glass-dark flex items-center justify-between px-6 z-10 shrink-0 border-b border-white/5">
        <h1 class="text-xl font-bold bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent">
          YouTube Player Local
        </h1>
        <div class="flex items-center gap-2">
          <button 
            onClick={() => settingsState.isSettingsOpen.value = true}
            class="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
        </div>
      </header>

      <main class="flex-1 overflow-hidden flex relative">
        <aside class="w-64 glass border-r border-white/5 flex flex-col hidden md:flex">
          <div class="p-4 border-b border-white/5">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Importar Playlist</h2>
            <div class="flex flex-col gap-2">
              <input 
                type="text" 
                value={importUrl}
                onInput={(e) => setImportUrl(e.target.value)}
                placeholder="URL de YouTube..." 
                class="w-full bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <button 
                onClick={handleImport}
                disabled={playlistState.isLoading.value || !importUrl}
                class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {playlistState.isLoading.value ? 'Cargando...' : 'Importar'}
              </button>
            </div>
          </div>
          
          <div class="p-4 flex-1 overflow-y-auto flex flex-col">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tus Listas</h2>
             {playlistState.playlists.value.map(pl => (
               <button 
                key={pl.id}
                onClick={() => playlistState.activePlaylist.value = pl}
                class={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm truncate mb-1 ${
                  activePlaylist?.id === pl.id ? 'bg-blue-600 text-white' : 'hover:bg-white/10'
                }`}
              >
                 {pl.title}
               </button>
             ))}
             {activePlaylist && (
               <div class="w-full h-[200px] max-h-[200px] mt-auto shrink-0 overflow-hidden rounded-xl bg-black border border-white/10 shadow-xl">
                 <div
                   id="yt-player-shell"
                   class="w-full h-full"
                   aria-label="Reproductor de YouTube"
                 >
                   <div id="yt-player-container" class="w-full h-full"></div>
                 </div>
               </div>
             )}
           </div>
        </aside>

        <section class="flex-1 overflow-hidden p-0 bg-gradient-to-br from-gray-900 to-black relative">
          {activePlaylist ? (
            <div class="h-full flex flex-col">
              {/* Playlist Header */}
              <div class="p-8 pb-6 bg-gradient-to-b from-blue-900/40 to-transparent flex gap-6 items-end">
                <img src={activePlaylist.thumbnail} alt="Playlist cover" class="w-48 h-48 rounded-xl shadow-2xl object-cover" />
                <div class="flex-1">
                  <h4 class="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Playlist Pública</h4>
                  <h2 class="text-5xl font-bold text-white mb-4 shadow-black/50">{activePlaylist.title}</h2>
                  <p class="text-gray-300 text-sm">
                    {activePlaylist.tracks.length} canciones • Importada recientemente
                  </p>
                </div>
                {!activePlaylist.youtubePlaylistId && (
                  <p class="text-xs text-gray-400 text-right pb-2 max-w-[200px]">
                    Playlist local — crea una playlist en YouTube y sincronízala para mantenerla actualizada
                  </p>
                )}
              </div>
              
              {/* Playlist Table */}
              <div class="px-8 pb-8 flex-1 min-h-0 overflow-y-auto flex flex-col">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="relative w-64">
                    <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input 
                      type="text" 
                      value={playlistState.searchQuery.value}
                      onInput={(e) => playlistState.searchQuery.value = e.target.value}
                      placeholder="Buscar en la lista..."
                      class="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    </div>
                    <div class="relative">
                      <div class="flex flex-wrap items-center gap-1.5 min-h-[42px] min-w-64 max-w-[32rem] bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 focus-within:border-blue-500 transition-colors">
                      <svg class="w-5 h-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        {playlistState.artistFilters.value.map(artist => (
                        <span class="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-xs text-blue-200">
                          {artist}
                          <button
                            type="button"
                            onClick={() => removeArtistFilter(artist)}
                            class="text-blue-300 hover:text-white"
                            title={`Quitar filtro ${artist}`}
                            aria-label={`Quitar filtro ${artist}`}
                          >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </span>
                        ))}
                        <input
                          type="text"
                          value={artistInput}
                          onInput={(e) => setArtistInput(e.target.value)}
                          onKeyDown={addArtistFilter}
                          placeholder={playlistState.artistFilters.value.length ? 'Añadir artista...' : 'Artista + Enter'}
                          title="Escribe un artista y pulsa Enter"
                          class="min-w-28 flex-1 bg-transparent py-1 text-sm text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => addArtistFilterValue(artistInput)}
                          disabled={!artistInput.trim()}
                          class="shrink-0 p-1.5 rounded-md text-gray-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Agregar artista"
                          aria-label="Agregar artista"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m2.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </button>
                      </div>
                      {artistInput.trim() && uniqueArtists.length > 0 && (
                        <div class="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-gray-900 shadow-xl overflow-hidden">
                          {uniqueArtists.map(artist => (
                            <button
                              type="button"
                              onClick={() => addArtistFilterValue(artist)}
                              class="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              {artist}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {(totalProblems > 0) && (
                    <button
                      onClick={() => playlistState.problemFilter.value = !playlistState.problemFilter.value}
                      class={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                        playlistState.problemFilter.value
                          ? 'bg-red-500/25 border-red-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-red-500/15 hover:border-red-500/40'
                      }`}
                      title={playlistState.problemFilter.value ? 'Mostrar todas las canciones' : 'Mostrar solo canciones con problemas'}
                    >
                      <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                      <span>{counts.broken} rotas</span>
                      {counts.warning > 0 && <span class="text-amber-300">{counts.warning} avisos</span>}
                      {playlistState.problemFilter.value && <span class="text-gray-300">• solo problemas</span>}
                    </button>
                  )}
                </div>
                {playlistState.problemFilter.value && filteredTracks.value.length === 0 && (
                  totalProblems === 0 ? (
                  <div class="py-6 text-center text-sm text-green-400 flex items-center justify-center gap-3">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                    Sin errores en la lista
                    <button
                      onClick={() => playlistState.problemFilter.value = false}
                      class="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/40 hover:text-white transition-colors font-medium"
                    >
                      Volver a la lista
                    </button>
                  </div>
                  ) : (
                  <div class="py-6 text-center text-sm text-gray-400">
                    Ninguna canción con problemas coincide con la búsqueda actual.
                  </div>
                  )
                )}
                
                <table class="w-full text-left text-sm text-gray-400">
                  <thead class="border-b border-white/10 text-gray-400 uppercase text-xs">
                    <tr>
                      <th class="pb-3 w-12 text-center">#</th>
                      <th class="pb-3">
                        <button
                          onClick={() => toggleSort('title')}
                          class={`inline-flex items-center gap-1 uppercase hover:text-white transition-colors ${playlistState.sortKey.value === 'title' ? 'text-blue-400' : ''}`}
                          title="Ordenar por título (clic: ascendente, descendente, desactivado)"
                        >
                          Título de Canción
                          {playlistState.sortKey.value === 'title' ? (
                            <svg class={`w-3 h-3 ${playlistState.sortDirection.value === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
                          ) : (
                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"></path></svg>
                          )}
                        </button>
                      </th>
                      <th class="pb-3">
                        <button
                          onClick={() => toggleSort('artist')}
                          class={`inline-flex items-center gap-1 uppercase hover:text-white transition-colors ${playlistState.sortKey.value === 'artist' ? 'text-blue-400' : ''}`}
                          title="Ordenar por artista (clic: ascendente, descendente, desactivado)"
                        >
                          Artista Extraído
                          {playlistState.sortKey.value === 'artist' ? (
                            <svg class={`w-3 h-3 ${playlistState.sortDirection.value === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
                          ) : (
                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"></path></svg>
                          )}
                        </button>
                      </th>
                      <th class="pb-3 min-w-[90px]">
                        <button
                          onClick={() => toggleSort('publishedAt')}
                          class={`inline-flex items-center gap-1 uppercase hover:text-white transition-colors ${playlistState.sortKey.value === 'publishedAt' ? 'text-blue-400' : ''}`}
                          title="Ordenar por fecha de publicación (clic: ascendente, descendente, desactivado)"
                        >
                          Subido
                          {playlistState.sortKey.value === 'publishedAt' ? (
                            <svg class={`w-3 h-3 ${playlistState.sortDirection.value === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
                          ) : (
                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"></path></svg>
                          )}
                        </button>
                      </th>
                      <th class="pb-3 text-right pr-3 min-w-[90px]">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTracks.map((track, idx) => {
                      const isPlaying = playerState.currentTrack.value?.videoId === track.videoId;
                      return (
                        <tr 
                          key={track.id} 
                          onClick={() => playTrack(track)}
                          class={`group hover:bg-white/5 cursor-pointer transition-colors ${isPlaying ? 'bg-white/10' : ''}`}
                        >
                          <td class="py-3 text-center rounded-l-lg">
                            {isPlaying ? (
                              <svg class="w-4 h-4 mx-auto text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
                            ) : (
                              <span class="group-hover:hidden">{idx + 1}</span>
                            )}
                            <svg class="w-4 h-4 mx-auto text-white hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                          </td>
                          <td class="py-3">
                            <div class="flex items-center gap-3 min-w-0">
                              <img src={track.thumbnailUrl} class="w-10 h-10 rounded object-cover shrink-0" />
                              <span class={`font-medium truncate max-w-[340px] ${isPlaying ? 'text-blue-400' : 'text-gray-200'}`} title={track.title}>
                                {track.title}
                              </span>
                            </div>
                          </td>
                          <td class="py-3 flex items-center justify-between gap-2 pr-3 min-w-0">
                            <span class="truncate max-w-[200px]" title={track.artist}>{track.artist}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playlistState.editingTrack.value = track;
                              }}
                              class="p-1.5 rounded-md text-blue-400 bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/50 hover:text-white hover:border-blue-400/60 transition-all opacity-0 group-hover:opacity-100"
                              title="Editar metadatos"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                          </td>
                          <td class="py-3 text-xs whitespace-nowrap min-w-[90px]">
                            <span title={track.publishedAt || ''}>{formatUploadDate(track.publishedAt)}</span>
                          </td>
                          <td class="py-3 pr-3 text-right rounded-r-lg min-w-[90px]">
                            <StatusBadge
                              status={track.removedFromSource ? 'removed' : track.status}
                              message={track.removedFromSource ? 'Ya no está en la playlist de YouTube, pero sigue guardada con su información' : track.statusMessage}
                              onClick={() => {
                                if (track.removedFromSource) {
                                  window.open(`https://www.youtube.com/watch?v=${track.videoId}`, '_blank');
                                } else {
                                  playlistState.repairTrack.value = track;
                                }
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTracks.value.length > playlistState.visibleLimit.value && (
                  <div class="flex items-center justify-center gap-3 pt-4">
                    <span class="text-xs text-gray-500">
                      Mostrando {visibleTracks.length} de {filteredTracks.value.length} (el shuffle y el filtrado usan todas)
                    </span>
                    <button
                      onClick={() => playlistState.visibleLimit.value += 100}
                      class="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors font-medium"
                    >
                      Mostrar más
                    </button>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div class="h-full flex flex-col items-center justify-center text-gray-500">
              <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
              <p>Importa o selecciona una playlist para comenzar.</p>
            </div>
          )}

        </section>
      </main>

      <PlayerBar />
      <SettingsModal />
      <TrackEditModal />
      <TrackRepairModal />

      {playlistState.toast.value && (
        <div
          role="status"
          class="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 min-w-[260px] justify-center px-5 py-3 rounded-xl bg-emerald-500/95 border border-emerald-300/70 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(16,185,129,0.45)] animate-[fadeIn_0.2s_ease-out]"
        >
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white font-bold">OK</span>
          <span>{playlistState.toast.value}</span>
        </div>
      )}
    </div>
  );
}

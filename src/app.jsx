import { useEffect, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import { PlayerBar } from './components/player/PlayerBar.jsx';
import { SettingsModal } from './components/settings/SettingsModal.jsx';
import { initYouTubePlayer, playTrack } from './api/iframePlayer.js';
import { extractPlaylistId } from './api/youtubeApi.js';
import { playerState } from './state/playerState.js';
import { settingsState } from './state/settingsState.js';
import { playlistState, loadLocalPlaylists, importYouTubePlaylist, playNextTrack, filteredTracks } from './state/playlistState.js';

// Auto-play siguiente canción cuando termine
effect(() => {
  if (playerState.trackEndedFlag.value > 0) {
    playNextTrack();
  }
});

export function App() {
  const [importUrl, setImportUrl] = useState('');

  useEffect(() => {
    initYouTubePlayer();
    loadLocalPlaylists();
  }, []);

  const handleImport = () => {
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
    
    importYouTubePlaylist(playlistId, settingsState.apiKey.value);
    setImportUrl('');
  };

  const activePlaylist = playlistState.activePlaylist.value;

  return (
    <div class="h-screen w-full flex flex-col bg-gray-900 text-gray-100">
      <header class="h-16 glass-dark flex items-center justify-between px-6 z-10 shrink-0 border-b border-white/5">
        <h1 class="text-xl font-bold bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent">
          YouTube Player Local
        </h1>
        <button 
          onClick={() => settingsState.isSettingsOpen.value = true}
          class="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
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
          
          <div class="p-4 flex-1 overflow-y-auto">
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
          </div>
        </aside>

        <section class="flex-1 overflow-y-auto p-0 bg-gradient-to-br from-gray-900 to-black relative">
          {activePlaylist ? (
            <div class="h-full flex flex-col">
              {/* Playlist Header */}
              <div class="p-8 pb-6 bg-gradient-to-b from-blue-900/40 to-transparent flex gap-6 items-end">
                <img src={activePlaylist.thumbnail} alt="Playlist cover" class="w-48 h-48 rounded-xl shadow-2xl object-cover" />
                <div>
                  <h4 class="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Playlist Pública</h4>
                  <h2 class="text-5xl font-bold text-white mb-4 shadow-black/50">{activePlaylist.title}</h2>
                  <p class="text-gray-300 text-sm">{activePlaylist.tracks.length} canciones • Importada recientemente</p>
                </div>
              </div>
              
              {/* Playlist Table */}
              <div class="px-8 pb-8 flex-1 flex flex-col">
                <div class="flex items-center justify-between mb-4">
                  <div class="relative w-64">
                    <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input 
                      type="text" 
                      value={playlistState.searchQuery.value}
                      onInput={(e) => playlistState.searchQuery.value = e.target.value}
                      placeholder="Buscar en la lista..."
                      class="w-full bg-black/40 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
                
                <table class="w-full text-left text-sm text-gray-400">
                  <thead class="border-b border-white/10 text-gray-400 uppercase text-xs">
                    <tr>
                      <th class="pb-3 w-12 text-center">#</th>
                      <th class="pb-3">Título de Canción</th>
                      <th class="pb-3">Artista Extraído</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTracks.value.map((track, idx) => {
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
                            <div class="flex items-center gap-3">
                              <img src={track.thumbnailUrl} class="w-10 h-10 rounded object-cover" />
                              <span class={`font-medium ${isPlaying ? 'text-blue-400' : 'text-gray-200'}`}>
                                {track.title}
                              </span>
                            </div>
                          </td>
                          <td class="py-3 rounded-r-lg">
                            {track.artist}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
    </div>
  );
}

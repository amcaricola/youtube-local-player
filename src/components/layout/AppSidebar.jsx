import { playlistState } from '../../state/playlistState.js';

/** Barra lateral: importar playlists, listado y reproductor embebido. */
export function AppSidebar() {
  const activePlaylist = playlistState.activePlaylist.value;

  return (
    <aside class="w-64 glass border-r border-white/5 flex flex-col hidden md:flex">
      <div class="p-4 border-b border-white/5">
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Importar Playlist</h2>
        <button
          onClick={() => playlistState.isImportOpen.value = true}
          class="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
          title="Importar una playlist de YouTube o crear una playlist local"
        >
          Importar
        </button>
      </div>

      <div class="p-4 flex-1 overflow-y-auto flex flex-col">
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tus Listas</h2>
        {playlistState.playlists.value.map(pl => (
          <div key={pl.id} class="relative group mb-1">
            <button
              onClick={() => playlistState.activePlaylist.value = pl}
              class={`w-full text-left px-3 py-2 pr-9 rounded-md transition-colors text-sm truncate ${
                activePlaylist?.id === pl.id ? 'bg-blue-600 text-white' : 'hover:bg-white/10'
              }`}
            >
              {pl.title}
            </button>
            {activePlaylist?.id === pl.id && (
              <button
                onClick={() => playlistState.isPlaylistSettingsOpen.value = true}
                class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-white/20"
                aria-label="Configuración de la playlist"
                title="Configuración de la playlist"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
            )}
          </div>
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
  );
}
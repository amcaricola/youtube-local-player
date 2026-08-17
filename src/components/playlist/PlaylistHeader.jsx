import { playlistState } from '../../state/playlistState.js';

/** Cabecera de la playlist activa: portada, título y contadores. */
export function PlaylistHeader() {
  const active = playlistState.activePlaylist.value;
  if (!active) return null;

  return (
    <div class="p-8 pb-6 bg-gradient-to-b from-blue-900/40 to-transparent flex gap-6 items-end">
      <img src={active.thumbnail} alt="Playlist cover" class="w-48 h-48 rounded-xl shadow-2xl object-cover" />
      <div class="flex-1">
        <h4 class="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Playlist Pública</h4>
        <h2 class="text-5xl font-bold text-white mb-4 shadow-black/50">{active.title}</h2>
        <p class="text-gray-300 text-sm">
          {active.tracks.length} canciones • Importada recientemente
        </p>
      </div>
      {!active.youtubePlaylistId && (
        <p class="text-xs text-gray-400 text-right pb-2 max-w-[200px]">
          Playlist local — crea una playlist en YouTube y sincronízala para mantenerla actualizada
        </p>
      )}
    </div>
  );
}
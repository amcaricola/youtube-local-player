import { playlistState, filteredTracks, toggleSort } from '../../state/playlistState.js';
import { playerState } from '../../state/playerState.js';
import { playTrack } from '../../api/iframePlayer.js';
import { getRecoveryDaysLeft } from '../../api/linkStatus.js';
import { StatusBadge } from '../common/StatusBadge.jsx';

const formatUploadDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString();
};

const SortIcon = ({ active, desc }) => (
  active ? (
    <svg class={`w-3 h-3 ${desc ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
  ) : (
    <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"></path></svg>
  )
);

const SortButton = ({ label, sortKey }) => {
  const active = playlistState.sortKey.value === sortKey;
  return (
    <button
      onClick={() => toggleSort(sortKey)}
      class={`inline-flex items-center gap-1 uppercase hover:text-white transition-colors ${active ? 'text-blue-400' : ''}`}
      title="Ordenar (clic: ascendente, descendente, desactivado)"
    >
      {label}
      <SortIcon active={active} desc={playlistState.sortDirection.value === 'desc'} />
    </button>
  );
};

/** Tabla de tracks con orden, badges de estado y paginación visual. */
export function TrackTable() {
  const visibleTracks = filteredTracks.value.slice(0, playlistState.visibleLimit.value);

  return (
    <div class="px-8 pb-8 flex-1 min-h-0 overflow-y-auto">
      <table class="w-full text-left text-sm text-gray-400">
        <thead class="border-b border-white/10 text-gray-400 uppercase text-xs sticky top-0 z-10 bg-gray-900">
          <tr>
            <th class="pt-2 pb-3 w-12 text-center">#</th>
            <th class="pt-2 pb-3">
              <SortButton label="Título de Canción" sortKey="title" />
            </th>
            <th class="pt-2 pb-3">
              <SortButton label="Artista Extraído" sortKey="artist" />
            </th>
            <th class="pt-2 pb-3 min-w-[90px]">
              <SortButton label="Subido" sortKey="publishedAt" />
            </th>
            <th class="pt-2 pb-3 text-right pr-3 min-w-[90px]">Estado</th>
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
                    {track.thumbnailUrl ? (
                      <img src={track.thumbnailUrl} class="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div class="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0" title="Miniatura no disponible">
                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                      </div>
                    )}
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
                    recoveryDaysLeft={getRecoveryDaysLeft(track)}
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
  );
}
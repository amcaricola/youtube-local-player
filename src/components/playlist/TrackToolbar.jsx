import { useState } from 'preact/hooks';
import { playlistState, filteredTracks, problemCounts } from '../../state/playlistState.js';

/** Barra de herramientas: búsqueda, filtros de artista, problemas y agregar canción. */
export function TrackToolbar() {
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

  const active = playlistState.activePlaylist.value;
  const selectedArtists = new Set(playlistState.artistFilters.value.map(artist => artist.toLowerCase()));
  const artistSearch = artistInput.trim().toLowerCase();
  const uniqueArtists = [...new Map(
    (active?.tracks || [])
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

  const counts = problemCounts.value;
  const totalProblems = counts.broken + counts.warning;

  return (
    <div class="px-8 pb-4 shrink-0">
      <div class="flex flex-wrap items-center justify-between gap-3">
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
        <div class="flex flex-wrap items-center gap-2">
          <button
            onClick={() => playlistState.isAddTrackOpen.value = true}
            class="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-sm font-semibold text-white transition-all shadow-lg"
            title="Agregar una canción a esta playlist"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            <span>Agregar canción</span>
          </button>
          {totalProblems > 0 && (
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
    </div>
  );
}
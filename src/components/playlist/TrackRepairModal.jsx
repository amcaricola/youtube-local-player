import { useEffect, useMemo, useState } from 'preact/hooks';
import { playlistState } from '../../state/playlistState.js';
import { updateTrackMetadata } from '../../state/playlistCrud.js';
import { settingsState } from '../../state/settingsState.js';
import { searchVideos } from '../../api/youtubeApi.js';
import { checkTrackNow } from '../../api/linkChecker.js';

export function TrackRepairModal() {
  const track = playlistState.repairTrack.value;
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Video IDs ya presentes en la playlist (evita duplicados al reemplazar)
  const existingIds = useMemo(() => {
    const active = playlistState.activePlaylist.value;
    if (!active || !track) return new Set();
    return new Set(active.tracks.filter(t => t.id !== track.id).map(t => t.videoId));
  }, [playlistState.activePlaylist.value, track]);

  const doSearch = async (t) => {
    const apiKey = settingsState.apiKey.value;
    if (!apiKey) {
      setError('Configura tu API Key en los Ajustes para buscar reemplazos.');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const items = await searchVideos(`${t.artist} ${t.title}`, apiKey);
      setResults(items);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (track) {
      setResults([]);
      setError('');
      doSearch(track);
    }
  }, [track]);

  if (!track) return null;

  const handleClose = () => {
    if (!saving) playlistState.repairTrack.value = null;
  };

  const handleApply = async (item) => {
    const active = playlistState.activePlaylist.value;
    if (!active) return;
    setSaving(true);
    setError('');
    try {
      // Solo se conserva el nuevo enlace: título y artista del usuario no se tocan,
      // y la metadata de la API (fecha, miniatura, duración) la repuebla checkTrackNow.
      const applied = {
        ...track,
        videoId: item.videoId,
        thumbnailUrl: item.thumbnailUrl || track.thumbnailUrl,
        publishedAt: null,
        durationSeconds: null,
        status: 'unchecked',
        statusMessage: null,
        brokenAt: null,
        metadataFetchedAt: 0,
        lastCheckedAt: null
      };
      await updateTrackMetadata(active.id, track.id, applied);
      await checkTrackNow(active.id, applied);
      playlistState.repairTrack.value = null;
    } catch (e) {
      setError('No se pudo guardar el reemplazo: ' + e.message);
      setSaving(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={handleClose}>
      <div class="glass-dark w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-white/10 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            {track.thumbnailUrl && (
              <img src={track.thumbnailUrl} alt="Thumbnail" class="w-12 h-12 rounded object-cover" />
            )}
            <div>
              <h2 class="text-xl font-bold">Buscar Link de Reemplazo</h2>
              <p class="text-xs text-gray-400 truncate max-w-[280px]">{track.title} — {track.artist}</p>
            </div>
          </div>
          <button onClick={handleClose} class="text-gray-400 hover:text-white transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {track.statusMessage && (
          <div class="text-xs p-3 rounded-lg bg-red-500/15 text-red-300 mb-4">
            Motivo: {track.statusMessage}
          </div>
        )}

        <button
          onClick={() => doSearch(track)}
          disabled={searching}
          class="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 mb-3"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          {searching ? 'Buscando...' : 'Buscar de nuevo'}
        </button>

        {error && (
          <div class="text-sm p-3 rounded-lg bg-red-500/15 text-red-300 mb-3">{error}</div>
        )}

        {searching ? (
          <div class="py-8 text-center text-gray-400 text-sm">Buscando videos de reemplazo...</div>
        ) : (
          <div class="space-y-2">
            {results.length === 0 && !error && (
              <div class="py-8 text-center text-gray-400 text-sm">Sin resultados. Intenta buscar de nuevo.</div>
            )}
                        {results.map(item => {
              const alreadyInPlaylist = existingIds.has(item.videoId);
              return (
                <button
                  key={item.videoId}
                  onClick={() => handleApply(item)}
                  disabled={saving || alreadyInPlaylist}
                  class="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-colors text-left disabled:opacity-50"
                  title={alreadyInPlaylist ? 'Este video ya está en tu playlist' : undefined}
                >
                  <img src={item.thumbnailUrl} alt="Thumbnail" class="w-14 h-9 rounded object-cover shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-gray-100 truncate">{item.title}</div>
                    <div class="text-xs text-gray-400 truncate">{item.channelTitle}</div>
                  </div>
                  {alreadyInPlaylist ? (
                    <span class="shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors bg-amber-500/15 text-amber-300 border-amber-500/40">
                      Ya en la playlist
                    </span>
                  ) : (
                    <span class="shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors bg-blue-600/20 text-blue-300 border-blue-500/40">
                      {item.videoId === track.videoId ? 'Actual' : saving ? 'Guardando...' : 'Usar'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
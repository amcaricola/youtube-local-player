import { useEffect, useMemo, useState } from 'preact/hooks';
import { playlistState, showToast, updateTrackMetadata, removeTrackFromPlaylist } from '../../state/playlistState.js';
import { parseTrackMetadata } from '../../api/metadataParser.js';
import { getArtistSuggestions } from './artistSuggestions.js';

export function TrackEditModal() {
  const track = playlistState.editingTrack.value;
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist);
    }
  }, [track]);

  const artistSuggestions = useMemo(() => {
    return getArtistSuggestions(playlistState.activePlaylist.value, artist, track);
  }, [artist, track, playlistState.activePlaylist.value]);

  if (!track) return null;

  const handleReparse = () => {
    const parsed = parseTrackMetadata(track.originalTitle || track.title, track.channelTitle);
    setTitle(parsed.title);
    setArtist(parsed.artist);
  };

  // Espera a que los datos se persistan y cierra al terminar, mostrando
  // un toast de confirmación. Los errores se muestran dentro del modal.
  const handleSave = async () => {
    const active = playlistState.activePlaylist.value;
    if (!active) return;
    setSaving(true);
    setError('');
    try {
      await updateTrackMetadata(active.id, track.id, {
        title: title.trim() || track.title,
        artist: artist.trim() || track.artist
      });
      playlistState.editingTrack.value = null;
      showToast('Canción actualizada');
    } catch (e) {
      console.error('Error al guardar la canción:', e);
      setError('No se pudo guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    playlistState.editingTrack.value = null;
  };

  const handleRemoveTrack = async () => {
    const active = playlistState.activePlaylist.value;
    if (!active) return;
    setSaving(true);
    setError('');
    try {
      const removedTitle = track.title || track.originalTitle;
      await removeTrackFromPlaylist(active.id, track.id);
      playlistState.editingTrack.value = null;
      showToast(`Se eliminó "${removedTitle}"`);
    } catch (e) {
      console.error('Error al eliminar la canción:', e);
      setError('No se pudo eliminar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={handleClose}>
      <div class="glass-dark w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-3">
            {track.thumbnailUrl && (
              <img src={track.thumbnailUrl} alt="Thumbnail" class="w-12 h-12 rounded object-cover" />
            )}
            <div>
              <h2 class="text-xl font-bold">Editar Canción</h2>
              <p class="text-xs text-gray-400 truncate max-w-[260px]">{track.originalTitle || track.title}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            class="text-gray-400 hover:text-white transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {track.removedFromSource && (
          <div class="p-3 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-200 text-xs mb-4 space-y-2">
            <p>Esta canción ya no está en la playlist original de YouTube, pero sigue guardada en tu biblioteca con su información.</p>
            <div class="flex gap-2">
              <button
                onClick={() => window.open(`https://www.youtube.com/watch?v=${track.videoId}`, '_blank')}
                class="px-3 py-1.5 rounded-md bg-violet-500/30 hover:bg-violet-500/50 text-violet-100 font-medium transition-colors"
              >
                Re-agregar en YouTube
              </button>
              <button
                onClick={handleRemoveTrack}
                disabled={saving}
                class="px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-300 font-medium transition-colors disabled:opacity-50"
              >
                Eliminar de la biblioteca
              </button>
            </div>
          </div>
        )}

        {error && (
          <div class="text-xs p-3 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 mb-4">
            {error}
          </div>
        )}

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Título de la Canción</label>
            <input
              type="text"
              value={title}
              onInput={(e) => setTitle(e.target.value)}
              class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Nombre de la canción..."
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Artista</label>
            <div class="relative">
              <input
                type="text"
                value={artist}
                onInput={(e) => setArtist(e.target.value)}
                class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Nombre del artista..."
              />
              {artistSuggestions.length > 0 && (
                <div class="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-white/10 bg-gray-900 shadow-xl overflow-hidden">
                  {artistSuggestions.map(name => (
                    <button
                      type="button"
                      onClick={() => setArtist(name)}
                      class="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(track.originalTitle || track.channelTitle) && (
            <button
              onClick={handleReparse}
              class="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              title="Re-derivar artista y título desde el título original de YouTube"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              Limpiar con el parser automático
            </button>
          )}
        </div>

        <div class="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            disabled={saving}
            class="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            class="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-all disabled:opacity-50 text-white"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

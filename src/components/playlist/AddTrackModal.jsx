import { useState } from 'preact/hooks';
import { playlistState } from '../../state/playlistState.js';
import { addTrackToPlaylist } from '../../state/playlistCrud.js';
import { settingsState } from '../../state/settingsState.js';
import { extractVideoId } from '../../api/youtubeApi.js';
import { fetchVideoInfo } from '../../api/linkChecker.js';
import { parseTrackMetadata } from '../../api/metadataParser.js';

export function AddTrackModal() {
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    playlistState.isAddTrackOpen.value = false;
    setLink('');
    setName('');
    setArtist('');
    setError('');
  };

  const handleAdd = async () => {
    setError('');
    const videoId = extractVideoId(link);
    if (!videoId) {
      setError('Link o ID de YouTube inválido. Ej: https://www.youtube.com/watch?v=dQw4w9WgXcQ o dQw4w9WgXcQ');
      return;
    }

    setLoading(true);
    try {
      let title = name.trim();
      let artistValue = artist.trim();
      let thumbnailUrl = '';
      let publishedAt = null;
      let durationSeconds = null;
      let status = 'unchecked';
      let statusMessage = null;

      if (settingsState.apiKey.value) {
        try {
          const info = await fetchVideoInfo(videoId, settingsState.apiKey.value);
          if (info && info.snippet) {
            const parsed = parseTrackMetadata(info.snippet.title, info.snippet.channelTitle);
            title = title || parsed.title || videoId;
            artistValue = artistValue || parsed.artist || 'Desconocido';
            thumbnailUrl = info.snippet.thumbnails?.default?.url || '';
            publishedAt = info.snippet.publishedAt || null;
            durationSeconds = info.durationSeconds ?? null;
            status = info.status;
            statusMessage = info.message;
          }
        } catch (err) {
          console.error('No se pudo verificar el video automáticamente:', err);
        }
      }

      if (!title) title = videoId;
      if (!artistValue) artistValue = 'Desconocido';

      const now = Date.now();
      const track = {
        id: videoId,
        videoId,
        title,
        artist: artistValue,
        thumbnailUrl,
        publishedAt,
        durationSeconds,
        status,
        statusMessage,
        brokenAt: status === 'broken' ? now : null,
        metadataFetchedAt: status !== 'unchecked' ? now : 0,
        removedFromSource: false,
        addedAt: now,
        lastCheckedAt: status !== 'unchecked' ? now : null
      };

      const ok = await addTrackToPlaylist(playlistState.activePlaylist.value?.id, track);
      if (ok) handleClose();
    } finally {
      setLoading(false);
    }
  };

  if (!playlistState.isAddTrackOpen.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 class="text-2xl font-bold">Agregar canción</h2>
            <p class="text-sm text-gray-400">Añade una canción a esta playlist por link o ID de YouTube.</p>
          </div>
          <button
            onClick={handleClose}
            class="shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar agregar canción"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Link o ID de YouTube</label>
            <input
              type="text"
              value={link}
              onInput={(e) => setLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleAdd(); }}
              placeholder="https://www.youtube.com/watch?v=..."
              class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onInput={(e) => setName(e.target.value)}
              placeholder={settingsState.apiKey.value ? 'Automático con la API key' : 'Título de la canción'}
              class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Artista</label>
            <input
              type="text"
              value={artist}
              onInput={(e) => setArtist(e.target.value)}
              placeholder={settingsState.apiKey.value ? 'Automático con la API key' : 'Nombre del artista'}
              class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {settingsState.apiKey.value ? (
            <p class="text-xs text-gray-400">
              Con tu API key, solo el link es suficiente: nombre y artista se completan automáticamente (puedes corregirlos después).
            </p>
          ) : (
            <p class="text-xs text-amber-300/80">
              Sin API key, escribe nombre y artista manualmente. El link y la duración se podrán completar al configurar tu API key.
            </p>
          )}

          <button
            onClick={handleAdd}
            disabled={loading || !link.trim()}
            class="w-full mt-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {loading ? 'Agregando...' : 'Agregar canción'}
          </button>
        </div>

        {error && (
          <div class="text-sm p-3 mt-3 rounded-lg bg-red-500/20 text-red-300">{error}</div>
        )}
      </div>
    </div>
  );
}
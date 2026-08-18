import { useState } from 'preact/hooks';
import { playlistState, showToast } from '../../state/playlistState.js';
import { importYouTubePlaylist } from '../../state/playlistImports.js';
import { createLocalPlaylist } from '../../state/playlistCrud.js';
import { settingsState, refreshKeyStatus } from '../../state/settingsState.js';
import { modeState } from '../../state/modeState.js';
import { extractPlaylistId } from '../../api/youtubeApi.js';
import { runCascadingLinkCheck } from '../../api/linkChecker.js';

export function ImportPlaylistModal() {
  const [tab, setTab] = useState('youtube');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    playlistState.isImportOpen.value = false;
    setTab('youtube');
    setUrl('');
    setName('');
    setError('');
  };

  const handleImport = async () => {
    setError('');
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      setError('No se pudo extraer el ID de la Playlist. Usa un link válido como https://www.youtube.com/playlist?list=...');
      return;
    }
    if (modeState.isDemo.value) {
      setError('No disponible en versión demo.');
      return;
    }
    await refreshKeyStatus();
    if (!settingsState.hasServerKey.value) {
      setError('Configura tu API Key en los Ajustes primero.');
      playlistState.isImportOpen.value = false;
      settingsState.isSettingsOpen.value = true;
      return;
    }

    setLoading(true);
    try {
      await importYouTubePlaylist(playlistId);
      runCascadingLinkCheck();
      showToast('Playlist importada correctamente');
      handleClose();
    } catch (err) {
      console.error('Error al importar la playlist:', err);
      setError('No se pudo importar la playlist. Revisa el link e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocal = async () => {
    setError('');
    if (!name.trim()) {
      setError('Escribe un nombre para la playlist.');
      return;
    }

    setLoading(true);
    try {
      await createLocalPlaylist(name);
      showToast('Playlist local creada');
      handleClose();
    } catch (err) {
      console.error('Error al crear la playlist:', err);
      setError('No se pudo crear la playlist.');
    } finally {
      setLoading(false);
    }
  };

  if (!playlistState.isImportOpen.value) return null;

  const tabClass = (active) => active
    ? 'flex-1 py-2 rounded-md text-sm font-medium text-white transition-colors'
    : 'flex-1 py-2 rounded-md text-sm text-gray-400 hover:text-white transition-colors';

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 class="text-2xl font-bold">Añadir Playlist</h2>
            <p class="text-sm text-gray-400">Importa una playlist de YouTube o crea una playlist local.</p>
          </div>
          <button
            onClick={handleClose}
            class="shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar añadir playlist"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="flex gap-1 mb-4 p-1 rounded-lg bg-black/30 border border-white/10">
          <button
            onClick={() => { setTab('youtube'); setError(''); }}
            class={`${tabClass(tab === 'youtube')} ${tab === 'youtube' ? 'bg-blue-600' : ''}`}
          >
            Desde YouTube
          </button>
          <button
            onClick={() => { setTab('local'); setError(''); }}
            class={`${tabClass(tab === 'local')} ${tab === 'local' ? 'bg-purple-600' : ''}`}
          >
            Nueva playlist local
          </button>
        </div>

        {tab === 'youtube' ? (
          <>
            <input
              type="text"
              value={url}
              onInput={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleImport(); }}
              placeholder="https://www.youtube.com/playlist?list=..."
              class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleImport}
              disabled={loading || !url.trim()}
              class="w-full mt-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Importar'}
            </button>
            {modeState.isDemo.value ? (
              <p class="text-xs text-amber-300/80 mt-2">No disponible en versión demo.</p>
            ) : !settingsState.hasServerKey.value ? (
              <p class="text-xs text-amber-300/80 mt-2">Requiere API key — configúrala en Ajustes para importar.</p>
            ) : null}
          </>
        ) : (
          <>
            <input
              type="text"
              value={name}
              onInput={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleCreateLocal(); }}
              placeholder="Nombre de la playlist..."
              class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={handleCreateLocal}
              disabled={loading || !name.trim()}
              class="w-full mt-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear playlist'}
            </button>
          </>
        )}

        {error && (
          <div class="text-sm p-3 mt-3 rounded-lg bg-red-500/20 text-red-300">{error}</div>
        )}
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from 'preact/hooks';
import { settingsState } from '../../state/settingsState.js';
import { setMode, modeState } from '../../state/modeState.js';
import { authState, setMasterPassword } from '../../state/authState.js';
import { playlistState, showToast } from '../../state/playlistState.js';
import { loadLocalPlaylists } from '../../state/playlistImports.js';
import { playerState } from '../../state/playerState.js';
import { removeServerKey } from '../../api/youtubeApi.js';
import storage from '../../storage/index.js';

/** Exportar/importar respaldo y borrado total de la biblioteca. */
export function StorageSection({ onClose }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const importInputRef = useRef(null);

  useEffect(() => {
    setConfirmWipe(false);
    setStatus({ type: '', msg: '' });
  }, [settingsState.isSettingsOpen.value]);

  // Borrado total de datos a petición del usuario (Developer Policies III.E.4.g).
  const handleWipeAll = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    setConfirmWipe(false);
    await storage.clearAll();
    // En modo servidor el wipe deja una instancia nueva y abierta: también
    // elimina la contraseña maestra y la API key del servidor.
    if (modeState.isServer.value) {
      await setMasterPassword('');
      await removeServerKey().catch(() => {});
    }
    setMode('none');
    playerState.currentTrack.value = null;
    playlistState.playlists.value = [];
    playlistState.activePlaylist.value = null;
    showToast('Se eliminaron todos los datos');
    onClose();
  };

  const handleExport = async () => {
    try {
      const jsonData = await storage.exportData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `youtube-player-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Respaldo exportado correctamente');
    } catch (error) {
      console.error('Error al exportar el respaldo:', error);
      setStatus({ type: 'error', msg: 'No se pudo exportar el respaldo.' });
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await storage.importData(await file.text());
      await loadLocalPlaylists();
      playlistState.activePlaylist.value = playlistState.playlists.value[0] || null;
      showToast('Respaldo importado correctamente');
      setStatus({ type: 'success', msg: 'Datos restaurados correctamente.' });
    } catch (error) {
      console.error('Error al importar el respaldo:', error);
      setStatus({ type: 'error', msg: 'El archivo no es un respaldo válido.' });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div class="border-t border-white/10 pt-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">Datos de la biblioteca</h3>
      <p class="text-xs text-gray-500 mt-2 mb-4">
        Los títulos y artistas son editables y pueden diferir del video de YouTube. La fecha de publicación,
        miniatura y duración provienen de la API de YouTube y se renuevan automáticamente (máx. 30 días);
        si un link roto no se repara a tiempo, esa metadata se elimina y conservas tu título y artista.
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          onClick={handleExport}
          class="py-2 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-200 hover:bg-blue-500/30 transition-colors text-sm font-medium"
        >
          Exportar JSON
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          class="py-2 rounded-lg bg-purple-500/15 border border-purple-400/30 text-purple-200 hover:bg-purple-500/30 transition-colors text-sm font-medium"
        >
          Importar JSON
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          class="hidden"
        />
      </div>
      <button
        onClick={handleWipeAll}
        class={`w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors border ${
          confirmWipe
            ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
            : 'bg-transparent hover:bg-red-500/10 border-red-500/30 text-red-400'
        }`}
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        {confirmWipe ? '¿Confirmar? Se borrarán TODAS las playlists y metadatos' : 'Borrar todos mis datos'}
      </button>
      {status.msg && (
        <div class={`text-sm p-3 mt-3 rounded-lg ${
          status.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
        }`}>
          {status.msg}
        </div>
      )}
    </div>
  );
}
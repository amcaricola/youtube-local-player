import { useEffect, useRef, useState } from 'preact/hooks';
import { settingsState } from '../../state/settingsState.js';
import { modeState, setMode } from '../../state/modeState.js';
import { playlistState, showToast } from '../../state/playlistState.js';
import { loadLocalPlaylists } from '../../state/playlistImports.js';
import { playerState } from '../../state/playerState.js';
import { clearServerBackup, restoreFromServer } from '../../api/backupSync.js';
import storage from '../../storage/index.js';

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

/** Uso de almacenamiento, exportar/importar respaldo y borrado total. */
export function StorageSection({ onClose }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, limit: STORAGE_LIMIT_BYTES });
  const [status, setStatus] = useState({ type: '', msg: '' });
  const importInputRef = useRef(null);

  useEffect(() => {
    setConfirmWipe(false);
    setStatus({ type: '', msg: '' });
    if (settingsState.isSettingsOpen.value) {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += key.length + (localStorage.getItem(key) || '').length;
      }
      setStorageUsage({ used: total * 2, limit: STORAGE_LIMIT_BYTES });
    }
  }, [settingsState.isSettingsOpen.value]);

  // Borrado total de datos locales a petición del usuario (Developer Policies III.E.4.g).
  const handleWipeAll = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    setConfirmWipe(false);
    await storage.clearAll();
    await clearServerBackup();
    settingsState.apiKey.value = '';
    setMode('none');
    playerState.currentTrack.value = null;
    playlistState.playlists.value = [];
    playlistState.activePlaylist.value = null;
    showToast('Se eliminaron todos los datos locales');
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

  const handleRestoreServer = async () => {
    const ok = await restoreFromServer();
    if (ok) {
      showToast('Biblioteca restaurada desde el servidor');
      setStatus({ type: 'success', msg: 'Respaldo restaurado correctamente.' });
      onClose();
    } else {
      showToast('No hay respaldo en el servidor');
      setStatus({ type: 'error', msg: 'No se encontró un respaldo en el servidor.' });
    }
  };

  const storagePercent = Math.min(100, Math.round((storageUsage.used / storageUsage.limit) * 100));

  return (
    <div class="border-t border-white/10 pt-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-300">Almacenamiento Local</h3>
        <span class="text-xs text-gray-400">
          {(storageUsage.used / (1024 * 1024)).toFixed(1)} MB / {(storageUsage.limit / (1024 * 1024)).toFixed(0)} MB
        </span>
      </div>
      <div class="h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          class={`h-full rounded-full transition-all ${
            storagePercent >= 90 ? 'bg-red-500' : storagePercent >= 70 ? 'bg-amber-400' : 'bg-green-500'
          }`}
          style={{ width: `${storagePercent}%` }}
        ></div>
      </div>
      <p class="text-xs text-gray-400 mt-2">{storagePercent}% usado de la capacidad habitual del navegador.</p>
      <p class="text-xs text-gray-500 mt-2">
        Los títulos y artistas son editables y pueden diferir del video de YouTube. La fecha de publicación,
        miniatura y duración provienen de la API de YouTube y se renuevan automáticamente (máx. 30 días);
        si un link roto no se repara a tiempo, esa metadata se elimina y conservas tu título y artista.
      </p>
      {storagePercent >= 90 && (
        <p class="text-xs text-red-300 mt-1">
          El almacenamiento está casi lleno. Considera exportar un respaldo o eliminar playlists para liberar espacio.
        </p>
      )}
      <div class="grid grid-cols-2 gap-2 mt-4">
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
      {!modeState.isDemo.value && (
        <button
          onClick={handleRestoreServer}
          class="w-full mt-2 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
        >
          Restaurar desde servidor
        </button>
      )}
      <button
        onClick={handleWipeAll}
        class={`w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors border ${
          confirmWipe
            ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
            : 'bg-transparent hover:bg-red-500/10 border-red-500/30 text-red-400'
        }`}
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        {confirmWipe ? '¿Confirmar? Se borrarán TODAS las playlists y metadatos locales' : 'Borrar todos mis datos'}
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
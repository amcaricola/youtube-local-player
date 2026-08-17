import { useState } from 'preact/hooks';
import { playlistState, syncPlaylistWithYouTube, deletePlaylist, showToast } from '../../state/playlistState.js';
import { settingsState } from '../../state/settingsState.js';
import { modeState } from '../../state/modeState.js';
import { runCascadingLinkCheck, linkCheckerState } from '../../api/linkChecker.js';

export function PlaylistSettingsModal() {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!playlistState.isPlaylistSettingsOpen.value) return null;

  const active = playlistState.activePlaylist.value;
  const inDemo = modeState.isDemo.value;
  const needsKey = !inDemo && !settingsState.apiKey.value;

  const linkCheckDisabled = linkCheckerState.isRunning.value || inDemo || needsKey;
  const linkCheckReason = inDemo
    ? 'No disponible en versión demo'
    : needsKey
      ? 'Requiere API key'
      : '';

  const syncDisabled = playlistState.isSyncing.value || !active?.youtubePlaylistId || inDemo || needsKey;
  const syncReason = inDemo
    ? 'No disponible en versión demo'
    : !active?.youtubePlaylistId
      ? 'Esta playlist no está vinculada a YouTube'
      : needsKey
        ? 'Requiere API key'
        : '';

  const handleClose = () => {
    playlistState.isPlaylistSettingsOpen.value = false;
    setConfirmDelete(false);
  };

  const handleSync = async () => {
    if (!active?.youtubePlaylistId) return;
    if (!settingsState.apiKey.value) {
      playlistState.syncNotice.value = 'Configura tu API Key en los Ajustes para sincronizar.';
      setTimeout(() => { playlistState.syncNotice.value = null; }, 6000);
      return;
    }
    const result = await syncPlaylistWithYouTube(active, settingsState.apiKey.value);
    playlistState.syncNotice.value = result
      ? `Sincronizado: +${result.added} nuevas, ${result.removed} eliminadas de YouTube`
      : 'Esta playlist no está vinculada a YouTube.';
    setTimeout(() => { playlistState.syncNotice.value = null; }, 6000);
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    playlistState.isPlaylistSettingsOpen.value = false;
    await deletePlaylist(active.id);
    showToast('Playlist eliminada');
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="min-w-0">
            <h2 class="text-2xl font-bold mb-1">Configuración de la playlist</h2>
            <p class="text-sm text-gray-400 truncate">{active?.title}</p>
          </div>
          <button
            onClick={handleClose}
            class="shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar configuración de playlist"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="space-y-3">
          <button
            onClick={() => runCascadingLinkCheck(true)}
            disabled={linkCheckDisabled}
            class="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm text-gray-200"
            title={linkCheckReason || ''}
          >
            {linkCheckerState.isRunning.value ? (
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
            ) : (
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            )}
            {linkCheckerState.isRunning.value ? 'Verificando...' : 'Revisar estado de los links'}
          </button>
          {linkCheckReason && (
            <p class="text-xs text-amber-300/80 -mt-2">{linkCheckReason}</p>
          )}

          <button
            onClick={handleSync}
            disabled={syncDisabled}
            class="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm text-gray-200"
            title={syncReason || ''}
          >
            {playlistState.isSyncing.value ? (
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
            ) : (
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            )}
            {playlistState.isSyncing.value ? 'Sincronizando...' : 'Actualizar playlist desde YouTube'}
          </button>
          {syncReason && (
            <p class="text-xs text-amber-300/80 -mt-2">{syncReason}</p>
          )}

          {playlistState.syncNotice.value && (
            <div class="text-xs p-3 rounded-lg bg-blue-500/15 text-blue-300">{playlistState.syncNotice.value}</div>
          )}

          <button
            onClick={handleDelete}
            class={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors text-sm border ${
              confirmDelete
                ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
                : 'bg-red-500/10 hover:bg-red-500/25 border-red-500/30 text-red-400'
            }`}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            {confirmDelete
              ? `¿Confirmar? "${active?.title}" se eliminará definitivamente`
              : 'Eliminar playlist activa'}
          </button>
        </div>
      </div>
    </div>
  );
}
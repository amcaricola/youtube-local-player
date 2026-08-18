import { useEffect } from 'preact/hooks';
import { effect } from '@preact/signals';
import { PlayerBar } from './components/player/PlayerBar.jsx';
import { SettingsModal } from './components/settings/SettingsModal.jsx';
import { UserSettingsModal } from './components/settings/UserSettingsModal.jsx';
import { TrackEditModal } from './components/playlist/TrackEditModal.jsx';
import { TrackRepairModal } from './components/playlist/TrackRepairModal.jsx';
import { ImportPlaylistModal } from './components/playlist/ImportPlaylistModal.jsx';
import { PlaylistSettingsModal } from './components/playlist/PlaylistSettingsModal.jsx';
import { DemoIntroModal } from './components/layout/DemoIntroModal.jsx';
import { AuthGate } from './components/layout/AuthGate.jsx';
import { AddTrackModal } from './components/playlist/AddTrackModal.jsx';
import { AppHeader } from './components/layout/AppHeader.jsx';
import { AppSidebar } from './components/layout/AppSidebar.jsx';
import { PlaylistView } from './components/playlist/PlaylistView.jsx';
import { runCascadingLinkCheck } from './api/linkChecker.js';
import { initYouTubePlayer, playTrack, togglePlay, toggleMute, setVolume, seekTo } from './api/iframePlayer.js';
import { playerState } from './state/playerState.js';
import { settingsState, refreshKeyStatus } from './state/settingsState.js';
import { modeState } from './state/modeState.js';
import { authState } from './state/authState.js';
import { playlistState } from './state/playlistState.js';
import { loadLocalPlaylists, syncAllPlaylists } from './state/playlistImports.js';
import { loadDemoPlaylist } from './state/playlistDemo.js';
import { playNextTrack } from './state/playbackQueue.js';
import storage from './storage/index.js';

// Auto-play siguiente canción cuando termine
effect(() => {
  if (playerState.trackEndedFlag.value > 0) {
    // Resetear el flag ANTES de avanzar: si YouTube dispara ENDED
    // varias veces seguidas, solo avanzamos una canción.
    playerState.trackEndedFlag.value = 0;
    if (playlistState.repeatMode.value === 'one') {
      const current = playerState.currentTrack.value;
      if (current && current.videoId) {
        playTrack(current);
        return;
      }
    }
    playNextTrack();
  }
});

export function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

/**
 * Contenido de la app. Solo se monta cuando AuthGate ya confirmó la
 * autenticación (splash + LockScreen resueltos), así que el boot puede cargar
 * la biblioteca del servidor y arrancar el link checker sin exponer nada a
 * quien no tiene sesión.
 */
function AppContent() {
  useEffect(() => {
    (async () => {
      if (modeState.isDemo.value) {
        await loadDemoPlaylist();
        return;
      }
      // Defensivo: AuthGate ya bloqueó si hace falta; el boot corre desbloqueado.
      if (authState.isLocked.value) return;
      // El servidor es la fuente de verdad de la biblioteca (en modo servidor):
      // init() carga /api/library (y migra datos legacy de localStorage la
      // primera vez).
      await storage.init();
      await loadLocalPlaylists();
      // El estado de la API key del servidor (F3) marca si hay key configurada.
      await refreshKeyStatus();
      if (settingsState.autoSyncPlaylists.value) {
        const results = await syncAllPlaylists();
        const total = results.reduce((acc, r) => ({ added: acc.added + r.added, removed: acc.removed + r.removed }), { added: 0, removed: 0 });
        if (total.added > 0 || total.removed > 0) {
          playlistState.syncNotice.value = `Sincronizado: +${total.added} nuevas, ${total.removed} eliminadas de YouTube`;
          setTimeout(() => { playlistState.syncNotice.value = null; }, 6000);
        }
      }
      runCascadingLinkCheck();
    })();
  }, [authState.isLocked.value, modeState.isServer.value]);

  useEffect(() => {
    const handleShortcut = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      );
      const modalOpen = settingsState.isSettingsOpen.value ||
        playlistState.editingTrack.value ||
        playlistState.repairTrack.value;

      if (isTyping || modalOpen) return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!playerState.currentTrack.value) return;
        event.preventDefault();
        const amount = event.key === 'ArrowLeft' ? -5 : 5;
        const nextTime = Math.max(0, Math.min(
          playerState.duration.value || Infinity,
          playerState.currentTime.value + amount
        ));
        seekTo(nextTime);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const amount = event.key === 'ArrowUp' ? 5 : -5;
        setVolume(Math.max(0, Math.min(100, playerState.volume.value + amount)));
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const activePlaylist = playlistState.activePlaylist.value;

  useEffect(() => {
    if (activePlaylist) initYouTubePlayer();
  }, [activePlaylist?.id]);

  return (
    <div class="h-screen w-full flex flex-col bg-gray-900 text-gray-100">
      <AppHeader />

      <main class="flex-1 overflow-hidden flex relative">
        <AppSidebar />

        <section class="flex-1 overflow-hidden p-0 bg-gradient-to-br from-gray-900 to-black relative">
          <PlaylistView />
        </section>
      </main>

      <PlayerBar />
      <DemoIntroModal />
      <AddTrackModal />
      <SettingsModal />
      <UserSettingsModal />
      <ImportPlaylistModal />
      <PlaylistSettingsModal />
      <TrackEditModal />
      <TrackRepairModal />

      {playlistState.toast.value && (
        <div
          role="status"
          class="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 min-w-[260px] justify-center px-5 py-3 rounded-xl bg-emerald-500/95 border border-emerald-300/70 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(16,185,129,0.45)] animate-[fadeIn_0.2s_ease-out]"
        >
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white font-bold">OK</span>
          <span>{playlistState.toast.value}</span>
        </div>
      )}
    </div>
  );
}
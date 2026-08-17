import { playlistState } from '../../state/playlistState.js';
import { modeState } from '../../state/modeState.js';
import { WelcomeScreen } from '../layout/WelcomeScreen.jsx';
import { PlaylistHeader } from './PlaylistHeader.jsx';
import { TrackToolbar } from './TrackToolbar.jsx';
import { TrackTable } from './TrackTable.jsx';

/** Contenido del área principal: playlist activa, bienvenida o estado vacío. */
export function PlaylistView() {
  const activePlaylist = playlistState.activePlaylist.value;

  if (activePlaylist) {
    return (
      <div class="h-full flex flex-col">
        <PlaylistHeader />
        <TrackToolbar />
        <TrackTable />
      </div>
    );
  }

  if (modeState.mode.value === 'none') {
    return <WelcomeScreen />;
  }

  return (
    <div class="h-full flex flex-col items-center justify-center text-gray-500">
      <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
      <p>Importa o selecciona una playlist para comenzar.</p>
      {modeState.isServer.value && (
        <button
          onClick={() => { location.href = './demo'; }}
          class="mt-4 text-xs text-purple-300 hover:text-purple-200 underline underline-offset-2"
        >
          ¿Probar la versión demo?
        </button>
      )}
    </div>
  );
}
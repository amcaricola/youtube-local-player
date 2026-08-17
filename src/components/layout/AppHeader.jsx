import { modeState } from '../../state/modeState.js';
import { settingsState } from '../../state/settingsState.js';
import { exitDemoMode } from '../../state/playlistDemo.js';

/** Barra superior: logo, badge de demo y accesos a ajustes. */
export function AppHeader() {
  return (
    <header class="h-16 glass-dark flex items-center justify-between px-6 z-10 shrink-0 border-b border-white/5">
      <h1 class="text-xl font-bold bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent">
        YouTube Player Local
      </h1>
      <div class="flex items-center gap-2">
        {modeState.isDemo.value && (
          <span class="text-xs px-2.5 py-1 rounded-full bg-blue-600/20 border border-blue-400/30 text-blue-200 font-medium">
            Modo demo
            <button
              onClick={() => exitDemoMode()}
              class="ml-2 px-1.5 py-0.5 rounded-md bg-blue-600/40 hover:bg-blue-600/70 border border-blue-400/40 text-blue-100 text-xs font-medium transition-colors"
              title="Salir del modo demo"
            >
              Salir demo
            </button>
          </span>
        )}
        {!modeState.isDemo.value && (
          <button
            onClick={() => settingsState.isUserSettingsOpen.value = true}
            class="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            title="Ajustes de usuario"
            aria-label="Ajustes de usuario"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </button>
        )}
        <button
          onClick={() => settingsState.isSettingsOpen.value = true}
          class="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          title="Ajustes"
          aria-label="Abrir ajustes del reproductor"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
      </div>
    </header>
  );
}
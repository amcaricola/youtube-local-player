import { settingsState } from '../../state/settingsState.js';
import { modeState } from '../../state/modeState.js';

/** Toggles de comportamiento: sincronización automática y chequeo de links. */
export function TogglesSection() {
  return (
    <>
      <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
        <div>
          <div class="text-sm font-medium text-gray-200">Sincronizar playlists al iniciar</div>
          <div class="text-xs text-gray-400">Detecta canciones nuevas y eliminadas de cada playlist de YouTube</div>
          {modeState.isDemo.value && (
            <div class="text-xs text-amber-300/80 mt-1">No disponible en versión demo</div>
          )}
        </div>
        <button
          onClick={() => settingsState.autoSyncPlaylists.value = !settingsState.autoSyncPlaylists.value}
          disabled={modeState.isDemo.value}
          class={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${settingsState.autoSyncPlaylists.value ? 'bg-blue-600' : 'bg-gray-700'} ${modeState.isDemo.value ? 'opacity-40 cursor-not-allowed' : ''}`}
          title={settingsState.autoSyncPlaylists.value ? 'Activado' : 'Desactivado'}
        >
          <span class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settingsState.autoSyncPlaylists.value ? 'left-[22px]' : 'left-0.5'}`}></span>
        </button>
      </div>

      <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
        <div>
          <div class="text-sm font-medium text-gray-200">Verificación automática de links</div>
          <div class="text-xs text-gray-400">Revisa en segundo plano si los videos siguen disponibles</div>
          {modeState.isDemo.value && (
            <div class="text-xs text-amber-300/80 mt-1">No disponible en versión demo</div>
          )}
        </div>
        <button
          onClick={() => settingsState.autoCheckLinks.value = !settingsState.autoCheckLinks.value}
          disabled={modeState.isDemo.value}
          class={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${settingsState.autoCheckLinks.value ? 'bg-blue-600' : 'bg-gray-700'} ${modeState.isDemo.value ? 'opacity-40 cursor-not-allowed' : ''}`}
          title={settingsState.autoCheckLinks.value ? 'Activado' : 'Desactivado'}
        >
          <span class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settingsState.autoCheckLinks.value ? 'left-[22px]' : 'left-0.5'}`}></span>
        </button>
      </div>
    </>
  );
}
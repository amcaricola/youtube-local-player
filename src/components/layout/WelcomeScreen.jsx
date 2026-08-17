import { setMode } from '../../state/modeState.js';
import { settingsState } from '../../state/settingsState.js';

export function WelcomeScreen() {
  const handleDemo = () => {
    location.href = './demo';
  };

  const handleServer = () => {
    setMode('servidor');
  };

  return (
    <div class="h-full flex flex-col items-center justify-center gap-10 p-8">
      <div class="text-center max-w-lg">
        <h2 class="text-3xl font-bold mb-3">Bienvenido a YouTube Player Local</h2>
        <p class="text-gray-400">Elige hacia dónde quieres apuntar. Todos tus datos se guardan localmente en tu navegador.</p>
      </div>

      <div class={`grid gap-6 w-full ${settingsState.demoEnabled.value ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' : 'max-w-sm'}`}>
        {settingsState.demoEnabled.value && (
          <button
            onClick={handleDemo}
            class="group glass-dark rounded-2xl p-6 text-left border border-white/10 hover:border-blue-400/50 hover:bg-white/5 transition-all"
          >
            <div class="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center mb-4 text-blue-300">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 class="text-lg font-semibold mb-1">Demo</h3>
            <p class="text-sm text-gray-400">Explora la app al instante con una playlist de ejemplo. No necesitas configurar nada.</p>
            <span class="inline-block mt-4 text-sm font-medium text-blue-300 group-hover:text-blue-200">Probar demo →</span>
          </button>
        )}

        <button
          onClick={handleServer}
          class="group glass-dark rounded-2xl p-6 text-left border border-white/10 hover:border-purple-400/50 hover:bg-white/5 transition-all"
        >
          <div class="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-400/30 flex items-center justify-center mb-4 text-purple-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
          </div>
          <h3 class="text-lg font-semibold mb-1">Servidor</h3>
          <p class="text-sm text-gray-400">Usa tu propia API Key o instancia para tus playlists personales y verificaciones reales.</p>
          <span class="inline-block mt-4 text-sm font-medium text-purple-300 group-hover:text-purple-200">Configurar →</span>
        </button>
      </div>
    </div>
  );
}
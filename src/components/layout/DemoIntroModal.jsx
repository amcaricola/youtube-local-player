import { playlistState, exitDemoMode } from '../../state/playlistState.js';

export function DemoIntroModal() {
  if (!playlistState.showDemoIntro.value) return null;

  const handleClose = () => {
    playlistState.showDemoIntro.value = false;
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </span>
            <div>
              <h2 class="text-xl font-bold">Modo demo</h2>
              <p class="text-sm text-gray-400">Estás explorando la versión demo</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            class="shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar modo demo"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <ul class="space-y-2.5 text-sm text-gray-300 mb-6">
          <li class="flex items-start gap-2.5">
            <svg class="w-5 h-5 text-blue-300 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
            <span>Playlist de ejemplo fija. Nada se guarda: al recargar vuelve al contenido original.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <svg class="w-5 h-5 text-blue-300 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
            <span>Las funciones que usan la API de YouTube (verificación de links, sincronización) están deshabilitadas.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <svg class="w-5 h-5 text-blue-300 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
            <span>Para tu biblioteca personal usa la versión servidor en la raíz (/) con tu propia API Key.</span>
          </li>
        </ul>

        <div class="flex gap-2">
          <button
            onClick={handleClose}
            class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors text-white"
          >
            Entendido
          </button>
          <button
            onClick={() => exitDemoMode()}
            class="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-semibold transition-colors text-gray-200"
          >
            Salir del modo demo
          </button>
        </div>
      </div>
    </div>
  );
}
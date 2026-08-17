import { settingsState } from '../../state/settingsState.js';
import { StatusDetailsSection } from './StatusDetailsSection.jsx';
import { TogglesSection } from './TogglesSection.jsx';
import { StorageSection } from './StorageSection.jsx';
import { ApiKeySection } from './ApiKeySection.jsx';

export function SettingsModal() {
  const handleClose = () => {
    settingsState.isSettingsOpen.value = false;
  };

  if (!settingsState.isSettingsOpen.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="sticky -top-6 z-10 -mx-6 px-6 pt-1 pb-4 bg-slate-900/95 backdrop-blur-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold mb-2">Ajustes del Reproductor</h2>
              <p class="text-sm text-gray-400">Configura tus credenciales para la API Oficial de YouTube.</p>
            </div>
            <button
              onClick={handleClose}
              class="shrink-0 text-gray-400 hover:text-white transition-colors"
              aria-label="Cerrar ajustes"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <StatusDetailsSection />
          <TogglesSection />
          <StorageSection onClose={handleClose} />
          <ApiKeySection onClose={handleClose} />
        </div>
      </div>
    </div>
  );
}
import { signal, effect } from '@preact/signals';

const STORED_API_KEY = localStorage.getItem('yt_api_key') || '';
const STORED_AUTO_CHECK = localStorage.getItem('yt_auto_check') !== 'false';
const STORED_AUTO_SYNC = localStorage.getItem('yt_auto_sync') !== 'false';

export const settingsState = {
  apiKey: signal(STORED_API_KEY),
  isSettingsOpen: signal(false),
  autoCheckLinks: signal(STORED_AUTO_CHECK),
  autoSyncPlaylists: signal(STORED_AUTO_SYNC)
};

// Guarda automáticamente la API Key cuando se actualiza
effect(() => {
  localStorage.setItem('yt_api_key', settingsState.apiKey.value);
});

// Guarda el toggle de verificación automática de links
effect(() => {
  localStorage.setItem('yt_auto_check', settingsState.autoCheckLinks.value ? 'true' : 'false');
});

// Guarda el toggle de sincronización automática al iniciar sesión
effect(() => {
  localStorage.setItem('yt_auto_sync', settingsState.autoSyncPlaylists.value ? 'true' : 'false');
});

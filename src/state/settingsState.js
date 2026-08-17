import { signal, effect } from '@preact/signals';

const STORED_API_KEY = localStorage.getItem('yt_api_key') || '';
const STORED_AUTO_CHECK = localStorage.getItem('yt_auto_check') !== 'false';
const STORED_AUTO_SYNC = localStorage.getItem('yt_auto_sync') !== 'false';
const STORED_DEMO_ENABLED = localStorage.getItem('yt_demo_enabled') !== 'false';

export const settingsState = {
  apiKey: signal(STORED_API_KEY),
  isSettingsOpen: signal(false),
  isUserSettingsOpen: signal(false),
  autoCheckLinks: signal(STORED_AUTO_CHECK),
  autoSyncPlaylists: signal(STORED_AUTO_SYNC),
  demoEnabled: signal(STORED_DEMO_ENABLED)
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

// Guarda si el super usuario permite la versión demo
effect(() => {
  localStorage.setItem('yt_demo_enabled', settingsState.demoEnabled.value ? 'true' : 'false');
});

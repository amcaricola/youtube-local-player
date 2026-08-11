import { signal, effect } from '@preact/signals';

const STORED_API_KEY = localStorage.getItem('yt_api_key') || '';

export const settingsState = {
  apiKey: signal(STORED_API_KEY),
  isSettingsOpen: signal(false)
};

// Guarda automáticamente la API Key cuando se actualiza
effect(() => {
  localStorage.setItem('yt_api_key', settingsState.apiKey.value);
});

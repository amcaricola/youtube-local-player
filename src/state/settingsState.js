import { signal, effect } from '@preact/signals';
import { isDemoRoute } from './demoRoute.js';

const read = (key, dflt) => {
  if (typeof localStorage === 'undefined') return dflt;
  return localStorage.getItem(key) ?? dflt;
};

// Fuente persistente (versión servidor / super usuario): se guarda en localStorage.
const persistent = {
  apiKey: signal(read('yt_api_key', '')),
  autoCheckLinks: signal(read('yt_auto_check', '') !== 'false'),
  autoSyncPlaylists: signal(read('yt_auto_sync', '') !== 'false'),
  demoEnabled: signal(read('yt_demo_enabled', '') !== 'false')
};

// Fuente de memoria (solo demo): aislada, arranca neutra y nunca se persiste.
// La demo no puede leer ni contaminar la configuración del super usuario.
const memory = {
  apiKey: signal(''),
  autoCheckLinks: signal(false),
  autoSyncPlaylists: signal(false)
};

// Estado de UI: siempre compartido entre demo y servidor.
const ui = {
  isSettingsOpen: signal(false),
  isUserSettingsOpen: signal(false)
};

const isDemoActive = () => isDemoRoute() && persistent.demoEnabled.value;

// Persistencia automática SOLO fuera de la demo: en la demo los cambios van a
// memoria y se descartan al recargar (el `yt_api_key`/toggles del super usuario
// quedan intactos).
const persist = (key, source) => effect(() => {
  if (typeof localStorage === 'undefined') return;
  if (!isDemoActive()) localStorage.setItem(key, String(source.value));
});

persist('yt_api_key', persistent.apiKey);
persist('yt_auto_check', persistent.autoCheckLinks);
persist('yt_auto_sync', persistent.autoSyncPlaylists);
persist('yt_demo_enabled', persistent.demoEnabled);

// Fachada: rutea lecturas/escrituras según si la demo está activa.
export const settingsState = new Proxy({}, {
  get(_, prop) {
    if (prop in ui) return ui[prop];
    if (prop === 'demoEnabled') return persistent.demoEnabled;
    const source = isDemoActive() ? memory : persistent;
    return source[prop];
  },
  set(_, prop, value) {
    if (prop in ui) {
      ui[prop].value = value;
      return true;
    }
    if (prop === 'demoEnabled') {
      persistent.demoEnabled.value = value;
      return true;
    }
    const source = isDemoActive() ? memory : persistent;
    if (prop in source) {
      source[prop].value = value;
      return true;
    }
    return false;
  }
});
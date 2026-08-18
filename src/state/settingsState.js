import { signal, effect } from '@preact/signals';
import { isDemoRoute } from './demoRoute.js';
import { getKeyStatus } from '../api/youtubeApi.js';

const read = (key, dflt) => {
  if (typeof localStorage === 'undefined') return dflt;
  return localStorage.getItem(key) ?? dflt;
};

// Fuente persistente (versión servidor / super usuario): se guarda en localStorage.
// La API key de YouTube YA NO vive en el navegador: se configura en el servidor
// (server/.config.json, F3) y aquí solo se refleja si el servidor tiene una.
// demoEnabled tampoco vive aquí: es decisión del super usuario en el servidor
// (server/.config.json) y se lee de /api/auth/status (o /unlock y /verify).
const persistent = {
  autoCheckLinks: signal(read('yt_auto_check', '') !== 'false'),
  autoSyncPlaylists: signal(read('yt_auto_sync', '') !== 'false')
};

// Fuente de memoria (solo demo): aislada, arranca neutra y nunca se persiste.
// La demo no puede leer ni contaminar la configuración del super usuario.
const memory = {
  autoCheckLinks: signal(false),
  autoSyncPlaylists: signal(false)
};

// Estado de UI: siempre compartido entre demo y servidor.
const ui = {
  isSettingsOpen: signal(false),
  isUserSettingsOpen: signal(false)
};

// Estado de la API key del servidor (F3): se rellena con refreshKeyStatus().
const serverInfo = {
  hasServerKey: signal(false)
};

// demoEnabled = si la ruta /demo existe. Lo decide el servidor (config del
// super usuario); el cliente solo lo refleja. Default true hasta que el
// servidor responda (authState lo actualiza en initAuth/reverify/unlock).
const demoEnabled = signal(true);

const isDemoActive = () => isDemoRoute() && demoEnabled.value;

// Persistencia automática SOLO fuera de la demo: en la demo los cambios van a
// memoria y se descartan al recargar (los toggles del super usuario quedan
// intactos).
const persist = (key, source) => effect(() => {
  if (typeof localStorage === 'undefined') return;
  if (!isDemoActive()) localStorage.setItem(key, String(source.value));
});

persist('yt_auto_check', persistent.autoCheckLinks);
persist('yt_auto_sync', persistent.autoSyncPlaylists);

/**
 * Persiste demoEnabled en el servidor (decisión del super usuario). En la
 * demo no hace nada (la demo no puede tocarla y tampoco la usa al servidor).
 * @param {boolean} enabled
 */
export const saveDemoEnabled = async (enabled) => {
  if (isDemoRoute()) return;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('yt_session_token') : '';
  try {
    await fetch('/api/auth/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: JSON.stringify({ demoEnabled: enabled })
    });
  } catch {
    // Servidor inalcanzable: el valor local se corrige en el próximo status.
  }
};

/**
 * Cambia demoEnabled y lo persiste en el servidor. Es el único camino de
 * escritura desde la UI (el signal también lo actualiza authState al leer
 * /api/auth/status, pero eso no debe re-guardarlo en el servidor).
 * @param {boolean} enabled
 */
export const setDemoEnabled = (enabled) => {
  demoEnabled.value = enabled;
  saveDemoEnabled(enabled);
};

/**
 * Consulta al servidor si tiene API key configurada y actualiza
 * `settingsState.hasServerKey`. En la demo siempre queda en false.
 * @returns {Promise<boolean>}
 */
export const refreshKeyStatus = async () => {
  try {
    serverInfo.hasServerKey.value = await getKeyStatus();
  } catch {
    serverInfo.hasServerKey.value = false;
  }
  return serverInfo.hasServerKey.value;
};

// Fachada: rutea lecturas/escrituras según si la demo está activa.
export const settingsState = new Proxy({}, {
  get(_, prop) {
    if (prop in ui) return ui[prop];
    if (prop === 'demoEnabled') return demoEnabled;
    if (prop === 'hasServerKey') return serverInfo.hasServerKey;
    const source = isDemoActive() ? memory : persistent;
    return source[prop];
  },
  set(_, prop, value) {
    if (prop in ui) {
      ui[prop].value = value;
      return true;
    }
    if (prop === 'demoEnabled') {
      setDemoEnabled(value);
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
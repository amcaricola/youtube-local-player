import { signal, computed, effect } from '@preact/signals';
import { settingsState } from './settingsState.js';
import { isDemoRoute } from './demoRoute.js';

const MODE_KEY = 'app_mode';

/**
 * El modo demo se activa por RUTA (`/demo`) y solo si el super usuario no lo
 * deshabilitó en el servidor (`demoEnabled` en server/.config.json). Nunca se
 * persiste en localStorage, así al refrescar vuelve siempre al contenido
 * original.
 * - 'none'     : sin decisión todavía → se muestra la pantalla de bienvenida.
 * - 'demo'     : ruta `/demo`, datos mock en memoria (no usa localStorage).
 * - 'servidor' : instancia personal / API Key del usuario (versión completa).
 */

const readSavedMode = () => {
  if (typeof localStorage === 'undefined') return 'none';
  const saved = localStorage.getItem(MODE_KEY);
  return saved === 'servidor' ? 'servidor' : 'none';
};

export const modeState = {
  mode: signal(isDemoRoute() && settingsState.demoEnabled.value ? 'demo' : readSavedMode()),
  isDemo: computed(() => modeState.mode.value === 'demo'),
  isServer: computed(() => modeState.mode.value === 'servidor')
};

// demoEnabled lo decide el servidor y llega de forma asíncrona (initAuth /
// reverify / unlock): cuando cambia, recomputa el modo si estamos en /demo
// (el super usuario puede habilitar/deshabilitar la demo en caliente).
effect(() => {
  const routeDemo = isDemoRoute();
  const enabled = settingsState.demoEnabled.value;
  const target = routeDemo && enabled ? 'demo' : readSavedMode();
  if (modeState.mode.value !== target) modeState.mode.value = target;
});

effect(() => {
  if (typeof localStorage === 'undefined') return;
  if (modeState.mode.value === 'demo') return; // la demo es por ruta, no se persiste
  localStorage.setItem(MODE_KEY, modeState.mode.value);
});

export const setMode = (mode) => {
  modeState.mode.value = mode;
};
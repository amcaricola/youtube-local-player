import { signal } from '@preact/signals';
import { modeState } from './modeState.js';
import { settingsState } from './settingsState.js';

const TOKEN_KEY = 'yt_session_token';
export const SESSION_DAYS = 30;

/**
 * El servidor es la única autoridad del acceso (el modo local ya no existe):
 * al arrancar SIEMPRE se consulta /api/auth/status (salvo en la ruta /demo,
 * que queda libre pero igual consulta el status público para conocer si el
 * super usuario tiene la demo habilitada).
 *
 * - Sin contraseña  -> la app arranca libre (bienvenida o biblioteca).
 * - Con contraseña  -> LockScreen siempre, salvo sesión válida (token).
 * - noAuthentication -> modo recuperación: sin contraseña + aviso en la UI.
 * - Servidor inalcanzable -> serverUnreachable (AuthGate muestra el error);
 *   la app no puede funcionar sin su fuente de verdad.
 */

const readToken = () => {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
};

/** Decodifica la expiración (exp) de un token firmado, sin verificarlo (solo UX). */
const tokenExpiry = (token) => {
  if (!token) return 0;
  try {
    const [body] = token.split('.');
    const b64 = body.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    return Number(payload.exp || 0);
  } catch {
    return 0;
  }
};

/** Sesión válida si hay token firmado del servidor (30 días). */
export const hasValidSession = () => {
  const exp = tokenExpiry(readToken());
  return exp > 0 && Date.now() < exp;
};

// Llamada a la API del servidor con el token de sesión en el header.
const api = async (path, options = {}) => {
  const token = readToken();
  const headers = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: token } : {})
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
};

// La demo (ruta /demo) queda libre: se resuelve al cargar el módulo.
const demoAtLoad = modeState.isDemo.value;

export const authState = {
  // ready = ya se conoce passwordRequired/isLocked (o si el servidor falló).
  ready: signal(demoAtLoad),
  // serverUnreachable = /api/auth/status falló al arrancar: la app no puede
  // funcionar sin el servidor (modo local eliminado).
  serverUnreachable: signal(false),
  // authDisabled = noAuthentication=true en el servidor (modo recuperación).
  authDisabled: signal(false),
  passwordRequired: signal(demoAtLoad ? false : false),
  isLocked: signal(demoAtLoad ? false : false)
};

const applyStatus = (data) => {
  authState.authDisabled.value = !!(data.noAuthentication);
  // Con la autenticación desactivada no se pide contraseña (modo recuperación).
  const passwordSet = data.passwordSet && !data.noAuthentication;
  authState.passwordRequired.value = passwordSet;
  authState.isLocked.value = passwordSet && !hasValidSession();
  if (typeof data.demoEnabled !== 'undefined') {
    settingsState.demoEnabled.value = data.demoEnabled !== false;
  }
};

/**
 * Resuelve el estado de autenticación inicial consultando SIEMPRE al servidor
 * (en la raíz). Si el servidor está inalcanzable la app no puede funcionar:
 * serverUnreachable activa la pantalla de error en AuthGate.
 * La demo queda libre, pero consulta el status público para conocer demoEnabled.
 */
let lastAuthMode = null;
export const initAuth = async () => {
  const isDemo = modeState.isDemo.value;
  const modeKey = isDemo ? 'demo' : 'root';
  if (lastAuthMode === modeKey && authState.ready.value) return;
  lastAuthMode = modeKey;

  if (isDemo) {
    authState.serverUnreachable.value = false;
    authState.authDisabled.value = false;
    authState.passwordRequired.value = false;
    authState.isLocked.value = false;
    authState.ready.value = true;
    // El servidor decide si la ruta /demo existe (demoEnabled). /api/auth/status
    // es público: en la demo se consulta solo para eso, sin bloquear nunca.
    try {
      const { ok, data } = await api('/api/auth/status');
      if (ok && typeof data.demoEnabled !== 'undefined') {
        settingsState.demoEnabled.value = data.demoEnabled !== false;
      }
    } catch {
      // Servidor inalcanzable: la demo sigue libre con el valor por defecto.
    }
    return;
  }

  authState.ready.value = false;
  try {
    const { ok, data } = await api('/api/auth/status');
    if (!ok) {
      authState.serverUnreachable.value = true;
      authState.ready.value = true;
      return;
    }
    authState.serverUnreachable.value = false;
    applyStatus(data);
  } catch {
    authState.serverUnreachable.value = true;
  }
  authState.ready.value = true;
};

/**
 * Establece, cambia o elimina la contraseña maestra (super usuario).
 * Al definir una nueva contraseña se abre una sesión para no bloquearse a sí mismo.
 * @param {string} password - Contraseña nueva (vacía = eliminar la protección).
 * @returns {Promise<boolean>}
 */
export const setMasterPassword = async (password) => {
  const { ok, data } = await api('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ password: password || '' })
  });
  if (!ok) return false;
  if (password) {
    // Se reactiva la autenticación (el servidor limpia noAuthentication) y
    // se abre sesión con el token devuelto (para no bloquearse al recargar).
    if (data.token && typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    authState.authDisabled.value = false;
    authState.passwordRequired.value = true;
  } else {
    // Eliminar la contraseña deja la instancia abierta (noAuthentication=true).
    authState.authDisabled.value = true;
    authState.passwordRequired.value = false;
  }
  authState.isLocked.value = false;
  return true;
};

/**
 * Verifica la contraseña maestra y abre una sesión de SESSION_DAYS días.
 * @param {string} password
 * @returns {Promise<boolean>} true si la contraseña es correcta
 */
export const unlockWithPassword = async (password) => {
  try {
    const { ok, data } = await api('/api/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    if (!ok || !data.token) return false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    if (typeof data.demoEnabled !== 'undefined') {
      settingsState.demoEnabled.value = data.demoEnabled !== false;
    }
    authState.isLocked.value = false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Re-verifica la sesión contra el servidor. El cliente manda su token y el
 * servidor confirma con OK si la sesión sigue activa en su registro. Sirve
 * para bloquear conexiones ya abiertas si la configuración cambia (p.ej. el
 * super usuario edita .config.json para exigir contraseña) o si la sesión fue
 * revocada (cambio de contraseña, "Bloquear ahora"). También refresca
 * demoEnabled (el super usuario puede deshabilitar la demo en caliente).
 * En la demo no hace nada.
 */
export const reverify = async () => {
  if (modeState.isDemo.value) return;
  try {
    const [statusRes, verifyRes] = await Promise.all([
      api('/api/auth/status'),
      api('/api/auth/verify')
    ]);
    if (statusRes.ok) {
      authState.serverUnreachable.value = false;
      applyStatus(statusRes.data);
    }
    const sessionValid = verifyRes.ok && verifyRes.data.ok === true;
    authState.isLocked.value = authState.passwordRequired.value && !sessionValid;
  } catch {
    // Servidor inalcanzable: conservar el estado actual (no bloquear por red).
  }
};

/**
 * Bloquea la instancia de inmediato (descarta la sesión actual).
 */
export const lockNow = () => {
  api('/api/auth/lock', { method: 'POST' }).catch(() => {});
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
  authState.isLocked.value = true;
};
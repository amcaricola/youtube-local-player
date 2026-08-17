import { signal } from '@preact/signals';
import { modeState } from './modeState.js';

const SESSION_KEY = 'yt_session_expires_at';
const PASSWORD_KEY = 'yt_master_password';
const TOKEN_KEY = 'yt_session_token';
export const SESSION_DAYS = 30;

/**
 * El servidor es la fuente de verdad del acceso: al arrancar SIEMPRE se
 * consulta /api/auth/status (salvo en la ruta /demo, que queda libre). El
 * servidor confirma si hay contraseña y si la autenticación está activa.
 *
 * - Sin contraseña  -> la app arranca libre (bienvenida o biblioteca).
 * - Con contraseña  -> LockScreen siempre, salvo sesión válida (token).
 * - noAuthentication -> modo recuperación: sin contraseña + aviso en la UI.
 *
 * En local (sin servidor) se conserva el comportamiento legacy de localStorage.
 */

const readStoredPassword = () => {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(PASSWORD_KEY) || '';
};

const readSessionExpiry = () => {
  if (typeof localStorage === 'undefined') return 0;
  return Number(localStorage.getItem(SESSION_KEY) || 0);
};

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

/**
 * Sesión válida si hay token firmado del servidor (30 días) o una sesión
 * legacy de localStorage sin vencer. Cualquiera de las dos abre la sesión.
 */
export const hasValidSession = () => {
  const exp = tokenExpiry(readToken());
  if (exp > 0 && Date.now() < exp) return true;
  const legacyExp = readSessionExpiry();
  return legacyExp > 0 && Date.now() < legacyExp;
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
  // ready = ya se conoce passwordRequired/isLocked. En la raíz hay que
  // consultar /api/auth/status antes; la demo arranca lista.
  ready: signal(demoAtLoad),
  // serverManaged = el servidor respondió /api/auth/status (es la autoridad).
  serverManaged: signal(false),
  // authDisabled = noAuthentication=true en el servidor (modo recuperación).
  authDisabled: signal(false),
  passwordRequired: signal(demoAtLoad ? false : !!readStoredPassword()),
  isLocked: signal(demoAtLoad ? false : (readStoredPassword() ? !hasValidSession() : false))
};

// Las operaciones de acceso usan el servidor si el modo es 'servidor' o si el
// servidor ya respondió (serverManaged), aunque el app_mode siga en 'none'.
const authUsesServer = () => modeState.isServer.value || authState.serverManaged.value;

/**
 * Resuelve el estado de autenticación inicial consultando SIEMPRE al servidor
 * (en la raíz), sin importar el app_mode del navegador. Si el servidor está
 * inalcanzable se cae al comportamiento legacy de localStorage.
 * La demo queda libre (no consulta).
 */
let lastAuthMode = null;
export const initAuth = async () => {
  const isDemo = modeState.isDemo.value;
  const modeKey = isDemo ? 'demo' : 'root';
  if (lastAuthMode === modeKey && authState.ready.value) return;
  lastAuthMode = modeKey;

  if (isDemo) {
    authState.serverManaged.value = false;
    authState.authDisabled.value = false;
    authState.passwordRequired.value = false;
    authState.isLocked.value = false;
    authState.ready.value = true;
    return;
  }

  authState.ready.value = false;
  try {
    const { ok, data } = await api('/api/auth/status');
    authState.serverManaged.value = ok;
    authState.authDisabled.value = !!(ok && data.noAuthentication);
    // Con la autenticación desactivada no se pide contraseña (modo recuperación).
    const passwordSet = ok && data.passwordSet && !data.noAuthentication;
    authState.passwordRequired.value = passwordSet;
    authState.isLocked.value = passwordSet && !hasValidSession();
  } catch {
    // Servidor inalcanzable: fallback legacy con la contraseña de localStorage.
    authState.serverManaged.value = false;
    authState.authDisabled.value = false;
    const pw = readStoredPassword();
    authState.passwordRequired.value = !!pw;
    authState.isLocked.value = !!pw && !hasValidSession();
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
  if (authUsesServer()) {
    const { ok } = await api('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ password: password || '' })
    });
    if (!ok) return false;
    authState.passwordRequired.value = !!password;
    authState.isLocked.value = false;
    return true;
  }
  const pw = password || '';
  if (typeof localStorage !== 'undefined') {
    if (pw) {
      localStorage.setItem(PASSWORD_KEY, pw);
      localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_DAYS * 86400000));
    } else {
      localStorage.removeItem(PASSWORD_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  }
  authState.passwordRequired.value = !!pw;
  authState.isLocked.value = false;
  return true;
};

/**
 * Verifica la contraseña maestra y abre una sesión de SESSION_DAYS días.
 * @param {string} password
 * @returns {Promise<boolean>} true si la contraseña es correcta
 */
export const unlockWithPassword = async (password) => {
  if (authUsesServer()) {
    try {
      const { ok, data } = await api('/api/auth/unlock', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      if (!ok || !data.token) return false;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      authState.isLocked.value = false;
      return true;
    } catch {
      return false;
    }
  }
  const pw = readStoredPassword();
  if (!pw) return true;
  if (password !== pw) return false;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_DAYS * 86400000));
  }
  authState.isLocked.value = false;
  return true;
};

/** Bloquea la instancia de inmediato (descarta la sesión actual). */
export const lockNow = () => {
  if (authUsesServer()) {
    api('/api/auth/lock', { method: 'POST' }).catch(() => {});
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
    authState.isLocked.value = true;
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
  authState.isLocked.value = true;
};
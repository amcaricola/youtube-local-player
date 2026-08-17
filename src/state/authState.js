import { signal } from '@preact/signals';

const SESSION_KEY = 'yt_session_expires_at';
const PASSWORD_KEY = 'yt_master_password';
export const SESSION_DAYS = 30;

// Temporal: hasta que exista el servidor/.env real, la contraseña maestra
// vive en localStorage del navegador del super usuario.
const readStoredPassword = () => {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(PASSWORD_KEY) || '';
};

let masterPassword = readStoredPassword();

const readSessionExpiry = () => {
  if (typeof localStorage === 'undefined') return 0;
  return Number(localStorage.getItem(SESSION_KEY) || 0);
};

// La sesión dura SESSION_DAYS días desde el último desbloqueo; al vencer se
// vuelve a pedir la contraseña (por seguridad).
export const hasValidSession = () => {
  const exp = readSessionExpiry();
  return exp > 0 && Date.now() < exp;
};

export const authState = {
  passwordRequired: signal(!!masterPassword),
  isLocked: signal((() => {
    if (!masterPassword) return false;
    return !hasValidSession();
  })())
};

/**
 * Establece, cambia o elimina la contraseña maestra (super usuario).
 * Al definir una nueva contraseña se abre una sesión para no bloquearse a sí mismo.
 * @param {string} password - Contraseña nueva (vacía = eliminar la protección).
 */
export const setMasterPassword = (password) => {
  masterPassword = password || '';
  if (typeof localStorage !== 'undefined') {
    if (masterPassword) {
      localStorage.setItem(PASSWORD_KEY, masterPassword);
      localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_DAYS * 86400000));
    } else {
      localStorage.removeItem(PASSWORD_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  }
  authState.passwordRequired.value = !!masterPassword;
  authState.isLocked.value = false;
};

/**
 * Verifica la contraseña maestra y abre una sesión de SESSION_DAYS días.
 * @param {string} password
 * @returns {boolean} true si la contraseña es correcta
 */
export const unlockWithPassword = (password) => {
  if (!masterPassword) return true;
  if (password !== masterPassword) return false;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_DAYS * 86400000));
  }
  authState.isLocked.value = false;
  return true;
};

/** Bloquea la instancia de inmediato (descarta la sesión actual). */
export const lockNow = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
  authState.isLocked.value = true;
};

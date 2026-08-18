import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Registro de sesiones otorgadas por el servidor. Cada sesión es una entrada
// { sid: { grantedAt, expiresAt } } persistida en server/data/sessions.json
// (gitignored, como la biblioteca). Permite saber cuándo se otorgó cada
// autorización y revocarla (al vencer los 30 días, al cambiar la contraseña,
// o al "bloquear ahora"). Con YT_SESSIONS_PATH los tests aíslan su propio
// archivo.
const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
export const SESSIONS_PATH = process.env.YT_SESSIONS_PATH || resolve(SERVER_DIR, 'data', 'sessions.json');

export const SESSION_DAYS = 30;

const readAll = () => {
  try {
    return JSON.parse(readFileSync(SESSIONS_PATH, 'utf8'));
  } catch {
    return { sessions: {} };
  }
};

const writeAll = (data) => {
  mkdirSync(dirname(SESSIONS_PATH), { recursive: true });
  writeFileSync(SESSIONS_PATH, JSON.stringify(data, null, 2));
};

// Elimina las sesiones ya vencidas (revocación por tiempo). Devuelve true si limpió algo.
const prune = (data) => {
  const now = Date.now();
  let changed = false;
  for (const [sid, s] of Object.entries(data.sessions || {})) {
    if (!s || !s.expiresAt || now > s.expiresAt) {
      delete data.sessions[sid];
      changed = true;
    }
  }
  return changed;
};

/**
 * Otorga una nueva sesión: registra el momento en que se concedió (grantedAt)
 * y su expiración a 30 días (expiresAt). Devuelve el sid de la sesión.
 */
export const createSession = () => {
  const now = Date.now();
  const data = readAll();
  prune(data);
  const sid = randomBytes(16).toString('hex');
  data.sessions[sid] = { grantedAt: now, expiresAt: now + SESSION_DAYS * 86400000 };
  writeAll(data);
  return { sid, grantedAt: now, expiresAt: data.sessions[sid].expiresAt };
};

/** Devuelve la sesión si está activa (existe y no venció); si no, null. */
export const getSession = (sid) => {
  const data = readAll();
  const s = data.sessions?.[sid];
  if (!s) return null;
  if (!s.expiresAt || Date.now() > s.expiresAt) {
    delete data.sessions[sid];
    writeAll(data);
    return null;
  }
  return s;
};

/** Revoca una sesión concreta (p.ej. "Bloquear ahora" o un cliente desconectado). */
export const revokeSession = (sid) => {
  if (!sid) return;
  const data = readAll();
  if (data.sessions?.[sid]) {
    delete data.sessions[sid];
    writeAll(data);
  }
};

/** Revoca todas las sesiones (al fijar/cambiar/eliminar la contraseña). */
export const revokeAllSessions = () => {
  writeAll({ sessions: {} });
};
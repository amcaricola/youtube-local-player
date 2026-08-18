import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getOrCreateSecret } from './config.js';
import { createSession, getSession } from './sessions.js';

export const SESSION_DAYS = 30;

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const b64urlDecode = (s) => Buffer.from(s, 'base64url');

/** Hash scrypt: `scrypt:<salt>:<hash>`. La contraseña nunca viaja ni se guarda. */
export const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
};

/** Verifica una contraseña contra el hash almacenado (comparación en tiempo constante). */
export const verifyPassword = (password, stored) => {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(String(password ?? ''), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};

/** Firma un payload JSON con HMAC-SHA256 (autenticidad + integridad). */
const sign = (payload) => {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', getOrCreateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
};

/** Verifica un token firmado y devuelve el payload si es válido y no venció. */
export const verifyToken = (token) => {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', getOrCreateSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

/**
 * Otorga una sesión: la registra en el servidor (grantedAt/expiresAt) y firma
 * un token que referencia su sid. El token caduca junto con la sesión (30 días).
 */
export const createSessionToken = () => {
  const session = createSession();
  return { token: sign({ sid: session.sid, exp: session.expiresAt }), exp: session.expiresAt };
};

/**
 * Verifica un token firmado Y que la sesión que referencia siga activa en el
 * registro del servidor (no vencida ni revocada). Esto permite revocar una
 * autorización de inmediato (cambio de contraseña, "Bloquear ahora") sin
 * esperar a que expire.
 */
export const verifySession = (token) => {
  const payload = verifyToken(token);
  if (!payload || !payload.sid) return null;
  return getSession(payload.sid) ? payload : null;
};

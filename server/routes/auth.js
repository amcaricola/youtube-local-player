import { Hono } from 'hono';
import { loadConfig, saveConfig } from '../config.js';
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySession,
  verifyToken
} from '../auth.js';
import { revokeAllSessions, revokeSession } from '../sessions.js';

const readBody = async (c) => c.req.json().catch(() => ({}));

// La autenticación se desactiva desde .config.json (noAuthentication=true),
// estilo Trilium: permite restablecer la contraseña maestra sin sesión.
const isAuthDisabled = (cfg) => cfg.noAuthentication === true;

export const authRoutes = new Hono();

// ¿Hay contraseña maestra configurada? El navegador decide si mostrar LockScreen.
// También reporta demoEnabled (la demo es una decisión del super usuario).
authRoutes.get('/status', (c) => {
  const cfg = loadConfig();
  return c.json({
    passwordSet: !!cfg.masterPasswordHash,
    noAuthentication: isAuthDisabled(cfg),
    demoEnabled: cfg.demoEnabled !== false
  });
});

// Configuración de la instancia (super usuario). Con contraseña configurada
// exige sesión; sin ella (o en modo recuperación) cualquiera puede cambiarla.
// Hoy solo gestiona demoEnabled, pero es el punto de entrada para futuras
// preferencias de la instancia (misma autorización que /password).
authRoutes.post('/settings', async (c) => {
  const body = await readBody(c);
  const cfg = loadConfig();
  if (!isAuthDisabled(cfg) && cfg.masterPasswordHash && !verifySession(c.req.header('Authorization') || '')) {
    return c.json({ ok: false, error: 'Requiere sesión activa para modificar la configuración.' }, 401);
  }
  if (typeof body.demoEnabled !== 'undefined') {
    saveConfig({ demoEnabled: !!body.demoEnabled });
  }
  return c.json({ ok: true });
});

// Desbloqueo: valida la contraseña y entrega un token de sesión (30 días).
// Si no hay contraseña configurada (o la autenticación está desactivada para
// recuperación), la instancia queda abierta.
authRoutes.post('/unlock', async (c) => {
  const { password } = await readBody(c);
  const cfg = loadConfig();
  const demoEnabled = cfg.demoEnabled !== false;
  if (isAuthDisabled(cfg) || !cfg.masterPasswordHash) {
    return c.json({ ok: true, token: createSessionToken().token, demoEnabled });
  }
  if (!verifyPassword(String(password ?? ''), cfg.masterPasswordHash)) {
    return c.json({ ok: false, error: 'Contraseña incorrecta.' }, 401);
  }
  return c.json({ ok: true, token: createSessionToken().token, demoEnabled });
});

// Verificación de la sesión: el cliente envía su token (Authorization) y el
// servidor confirma con OK si la sesión sigue activa en su registro. En una
// instancia abierta (sin contraseña) siempre responde OK. Útil para que la
// página re-bloquee conexiones ya abiertas si la configuración cambia.
authRoutes.get('/verify', (c) => {
  const cfg = loadConfig();
  const demoEnabled = cfg.demoEnabled !== false;
  if (isAuthDisabled(cfg) || !cfg.masterPasswordHash) {
    return c.json({ ok: true, authorized: true, expiresAt: null, demoEnabled });
  }
  const payload = verifySession(c.req.header('Authorization') || '');
  if (!payload) return c.json({ ok: false, authorized: false }, 401);
  return c.json({ ok: true, authorized: true, expiresAt: payload.exp, demoEnabled });
});

// Establecer / cambiar / eliminar la contraseña maestra.
// Una vez configurada, solo el super usuario desbloqueado (token válido) puede
// tocarla; con la autenticación desactivada se permite sin sesión (reset).
authRoutes.post('/password', async (c) => {
  const { password } = await readBody(c);
  const cfg = loadConfig();
  const next = String(password ?? '');
  if (next.length > 0 && next.length < 4) {
    return c.json({ ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' }, 400);
  }
  if (!isAuthDisabled(cfg) && cfg.masterPasswordHash && !verifySession(c.req.header('Authorization') || '')) {
    return c.json({ ok: false, error: 'Requiere sesión activa para cambiar la contraseña.' }, 401);
  }
  if (next) {
    // Al fijar/cambiar la contraseña se reactiva la autenticación en el
    // config (noAuthentication:false), se revocan TODAS las sesiones previas
    // y se entrega una sesión nueva para no bloquearse a sí mismo.
    saveConfig({ masterPasswordHash: hashPassword(next), noAuthentication: false });
    revokeAllSessions();
    return c.json({ ok: true, token: createSessionToken().token });
  }
  // Eliminar la contraseña deja la instancia abierta y marcada como
  // autenticación desactivada (mismo estado que el modo recuperación), para
  // que la UI muestre el aviso correspondiente. Se revocan las sesiones.
  saveConfig({ masterPasswordHash: null, noAuthentication: true });
  revokeAllSessions();
  return c.json({ ok: true });
});

// "Bloquear ahora": el servidor revoca la sesión presentada de inmediato (no
// solo en el navegador), así el token deja de ser válido en el registro.
authRoutes.post('/lock', (c) => {
  const payload = verifyToken(c.req.header('Authorization') || '');
  if (payload?.sid) revokeSession(payload.sid);
  return c.json({ ok: true });
});

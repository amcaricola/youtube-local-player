import { Hono } from 'hono';
import { loadConfig, saveConfig } from '../config.js';
import { createSessionToken, hashPassword, verifyPassword, verifyToken } from '../auth.js';

const readBody = async (c) => c.req.json().catch(() => ({}));

// La autenticación se desactiva desde .config.json (noAuthentication=true),
// estilo Trilium: permite restablecer la contraseña maestra sin sesión.
const isAuthDisabled = (cfg) => cfg.noAuthentication === true;

export const authRoutes = new Hono();

// ¿Hay contraseña maestra configurada? El navegador decide si mostrar LockScreen.
authRoutes.get('/status', (c) => {
  const cfg = loadConfig();
  return c.json({ passwordSet: !!cfg.masterPasswordHash, noAuthentication: isAuthDisabled(cfg) });
});

// Desbloqueo: valida la contraseña y entrega un token de sesión (30 días).
// Si no hay contraseña configurada (o la autenticación está desactivada para
// recuperación), la instancia queda abierta.
authRoutes.post('/unlock', async (c) => {
  const { password } = await readBody(c);
  const cfg = loadConfig();
  if (isAuthDisabled(cfg) || !cfg.masterPasswordHash) {
    return c.json({ ok: true, token: createSessionToken().token });
  }
  if (!verifyPassword(String(password ?? ''), cfg.masterPasswordHash)) {
    return c.json({ ok: false, error: 'Contraseña incorrecta.' }, 401);
  }
  return c.json({ ok: true, token: createSessionToken().token });
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
  if (!isAuthDisabled(cfg) && cfg.masterPasswordHash && !verifyToken(c.req.header('Authorization') || '')) {
    return c.json({ ok: false, error: 'Requiere sesión activa para cambiar la contraseña.' }, 401);
  }
  if (next) {
    saveConfig({ masterPasswordHash: hashPassword(next) });
  } else {
    saveConfig({ masterPasswordHash: null });
  }
  return c.json({ ok: true });
});

// El servidor es stateless: "bloquear" es que el navegador descarte su token.
authRoutes.post('/lock', (c) => c.json({ ok: true }));

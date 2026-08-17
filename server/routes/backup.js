import { Hono } from 'hono';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadConfig } from '../config.js';
import { verifyToken } from '../auth.js';

// Respaldo sin base de datos: el navegador envía su exportData() (esquema v2,
// solo la biblioteca del usuario) y el servidor lo guarda como JSON con
// rotación de copias. Restaurar es devolver ese JSON al importData().
const BACKUP_DIR = process.env.YT_BACKUP_DIR || fileURLToPath(new URL('../data/backups/', import.meta.url));
const MAX_BACKUPS = 3;

const isAuthDisabled = (cfg) => cfg.noAuthentication === true;

// Misma política que /api/auth/password: sin contraseña (o autenticación
// desactivada) el acceso es abierto; con contraseña se exige token de sesión.
const authorized = (c, cfg) => {
  if (isAuthDisabled(cfg) || !cfg.masterPasswordHash) return true;
  return !!verifyToken(c.req.header('Authorization') || '');
};

const listBackups = async () => {
  await mkdir(BACKUP_DIR, { recursive: true });
  const files = await readdir(BACKUP_DIR);
  // Los nombres son timestamps ISO (ordenables): el más reciente primero.
  return files.filter(f => f.endsWith('.json')).sort().reverse();
};

const pruneBackups = async () => {
  const backups = await listBackups();
  for (const file of backups.slice(MAX_BACKUPS)) {
    await unlink(join(BACKUP_DIR, file)).catch(() => {});
  }
};

export const backupRoutes = new Hono();

backupRoutes.post('/', async (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);

  const data = await c.req.text().catch(() => '');
  if (!data) return c.json({ ok: false, error: 'Cuerpo vacío.' }, 400);

  await mkdir(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  await writeFile(join(BACKUP_DIR, `backup-${ts}.json`), data, 'utf8');
  await pruneBackups();

  return c.json({ ok: true });
});

backupRoutes.get('/', async (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);

  const backups = await listBackups();
  if (backups.length === 0) {
    return c.json({ ok: false, error: 'No hay respaldo en el servidor.' }, 404);
  }

  const content = await readFile(join(BACKUP_DIR, backups[0]), 'utf8');
  return c.body(new Uint8Array(Buffer.from(content)), 200, { 'Content-Type': 'application/json' });
});

backupRoutes.delete('/', async (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);

  const backups = await listBackups();
  for (const file of backups) {
    await unlink(join(BACKUP_DIR, file)).catch(() => {});
  }
  return c.json({ ok: true });
});
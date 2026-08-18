import { Hono } from 'hono';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { verifySession } from '../auth.js';

// La biblioteca vive en el servidor como un único documento JSON (sin base de
// datos): es la fuente de verdad multi-dispositivo. El documento es el modelo
// interno completo `{ version, playlists: [...] }` (tracks con su metadata).
// Con `noAuthentication`/sin contraseña el acceso es abierto; con contraseña
// se exige token de sesión (misma política que /api/auth/password).
const LIBRARY_PATH = process.env.YT_LIBRARY_PATH || fileURLToPath(new URL('../data/library.json', import.meta.url));

const EMPTY_LIBRARY = { version: 2, playlists: [] };

const authorized = (c, cfg) => {
  if (cfg.noAuthentication === true || !cfg.masterPasswordHash) return true;
  return !!verifySession(c.req.header('Authorization') || '');
};

const readLibrary = async () => {
  try {
    return JSON.parse(await readFile(LIBRARY_PATH, 'utf8'));
  } catch {
    return EMPTY_LIBRARY;
  }
};

export const libraryRoutes = new Hono();

libraryRoutes.get('/', async (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);

  const library = await readLibrary();
  return c.body(new Uint8Array(Buffer.from(JSON.stringify(library))), 200, { 'Content-Type': 'application/json' });
});

const saveLibrary = async (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);

  const data = await c.req.text().catch(() => '');
  if (!data) return c.json({ ok: false, error: 'Cuerpo vacío.' }, 400);

  let library;
  try {
    library = JSON.parse(data);
  } catch {
    return c.json({ ok: false, error: 'JSON inválido.' }, 400);
  }
  if (!library || !Array.isArray(library.playlists)) {
    return c.json({ ok: false, error: 'Se esperaba { playlists: [...] }.' }, 400);
  }

  await mkdir(dirname(LIBRARY_PATH), { recursive: true });
  await writeFile(LIBRARY_PATH, JSON.stringify({ version: 2, playlists: library.playlists }), 'utf8');

  return c.json({ ok: true });
};

libraryRoutes.put('/', saveLibrary);

// Alias de PUT: permite flushes best-effort con navigator.sendBeacon (POST).
libraryRoutes.post('/', saveLibrary);

libraryRoutes.delete('/', async (c) => {
  const cfg = loadConfig();
  if (!authorized(c, cfg)) return c.json({ ok: false, error: 'Requiere sesión activa.' }, 401);

  await unlink(LIBRARY_PATH).catch(() => {});
  return c.json({ ok: true });
});
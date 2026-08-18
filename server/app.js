import { Hono } from 'hono';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { authRoutes } from './routes/auth.js';
import { libraryRoutes } from './routes/library.js';
import { youtubeRoutes } from './routes/youtube.js';
import { ROOT } from './config.js';

export const DIST = resolve(ROOT, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const sendFile = async (c, filePath) => {
  const data = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const isAsset = filePath.startsWith(resolve(DIST, 'assets')) || ext === '.map';
  return c.body(new Uint8Array(data), 200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
};

export const createApp = () => {
  const app = new Hono();

  // API (la ruta de la SPA se registra después: las peticiones /api/* se resuelven aquí).
  app.route('/api/auth', authRoutes);
  app.route('/api/library', libraryRoutes);
  app.route('/api/youtube', youtubeRoutes);

  // SPA: sirve los archivos estáticos de dist/ y cae al index.html para rutas
  // de la app (/, /demo, etc.). El servidor es quien responde la web.
  app.use('*', async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/')) return next();

    const rel = path === '/' ? 'index.html' : path.slice(1).split('?')[0];
    const target = resolve(DIST, rel);
    if (!target.startsWith(DIST)) return next();

    try {
      const s = await stat(target);
      if (s.isFile()) return sendFile(c, target);
    } catch {
      // archivo inexistente: probar con el fallback SPA
    }

    const index = resolve(DIST, 'index.html');
    try {
      await stat(index);
      return sendFile(c, index);
    } catch {
      return c.text('Build no encontrada. Ejecuta `npm run build` en la raíz del proyecto.', 500);
    }
  });

  return app;
};

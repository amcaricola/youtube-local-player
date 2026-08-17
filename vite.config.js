import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  server: {
    // En dev, el front (vite) delega /api al servidor Hono (npm run dev:server).
    // En producción el propio servidor sirve la SPA y la API (mismo origen).
    proxy: {
      '/api': 'http://127.0.0.1:3000'
    }
  }
});

import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 3000);
const app = createApp();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`YouTube Player Local — servidor en http://127.0.0.1:${info.port}`);
  console.log('Web: /  •  Demo: /demo  •  API: /api');
});

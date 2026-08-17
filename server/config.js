import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(SERVER_DIR, '..');
const ENV_PATH = resolve(SERVER_DIR, '.env');

// Ruta del estado generado por el servidor (authSecret + hash de la contraseña
// maestra). Se puede sobreescribir con YT_CONFIG_PATH (los tests usan un temp).
export const CONFIG_PATH = process.env.YT_CONFIG_PATH || resolve(SERVER_DIR, '.config.json');

try {
  // .env es opcional: PORT por defecto 3000.
  process.loadEnvFile(ENV_PATH);
} catch {
  // Sin .env el servidor igual arranca.
}

// NOTA: la configuración de la app (noAuthentication, masterPasswordHash,
// youtubeApiKey en F3) vive en .config.json (config.ini de este proyecto),
// NO en .env. El .env solo lleva lo específico del despliegue (PORT).

/** Lee la configuración del servidor (.config.json). */
export const loadConfig = () => {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
};

/** Persiste un parche sobre la configuración (merge). */
export const saveConfig = (patch) => {
  const next = { ...loadConfig(), ...patch };
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
};

/** Secreto HMAC para firmar sesiones: se genera una sola vez al primer arranque. */
export const getOrCreateSecret = () => {
  const cfg = loadConfig();
  if (!cfg.authSecret) {
    const authSecret = randomBytes(32).toString('base64url');
    saveConfig({ authSecret });
    return authSecret;
  }
  return cfg.authSecret;
};

# YouTube Playlist Player

Reproductor de playlists de YouTube **local-first** con servidor propio (Hono). Importa playlists públicas de YouTube, las guarda en tu instancia con **metadata editable** (título y artista), reproduce con el **reproductor oficial de YouTube (IFrame Player API)** y vigila la salud de los enlaces de forma automática: detecta videos eliminados, privados o con el **embed bloqueado**, sin perder nada de tu biblioteca.

> **Naturaleza del proyecto:** actúa como **recolector/preservador de playlists**. Aunque un video muera o deje de ser reproducible, su entrada permanece en tu biblioteca con su metadata editable y su enlace original, lista para que encuentres un reemplazo.

---

## ✨ Características

- **Importación de playlists** desde YouTube (Data API v3) o playlists locales vacías y editables.
- **Reproductor persistente** (barra inferior): play/pausa, seekbar, volumen, mute, pantalla completa del embed y atajos de teclado (`Espacio`, `←/→`, `↑/↓`, `M`).
- **Metadata editable**: parser heurístico de `Artista - Título`, con edición inline y en modal.
- **Shuffle real** (Fisher-Yates con historial): sin repetición hasta completar el ciclo de la playlist.
- **Filtrado en vivo** por título/artista, más un **chip de problemas** (roto/aviso) que compone con la búsqueda y afecta también a la cola de reproducción.
- **Link checker en cascada**: un barrido por sesión, educado con las cuotas de la API, que además **refresca la metadata** (miniatura, fecha, duración) manteniéndola bajo la política de retención de 30 días.
- **Copia reproducible (`playableVideoId`)**: si un video está vivo pero bloquea el embed, guardas un reemplazo que solo se usa para reproducir. El `videoId` original se conserva como **ancla** para la sync: no se duplica el tema ni se marca como fuera de playlist. Solo si el video original fue eliminado, el reemplazo pasa a ser el enlace principal.
- **Sync con YouTube**: las canciones nuevas se agregan al final; las eliminadas se marcan `removedFromSource` y **permanecen en local** con toda su metadata.
- **Backup/export JSON minimal**: solo la biblioteca del usuario (IDs + título/artista), sin metadata de la API — los respaldos pueden compartirse sin redistribuir datos de YouTube.
- **Modo demo** en `/demo`: explora la app al instante con una playlist de ejemplo, sin API key y sin tocar tus datos.
- **Contraseña maestra + sesiones de 30 días** gestionadas por el servidor; multi-dispositivo.
- **API key de YouTube solo en el servidor** (proxy F3): el navegador nunca la conoce ni la guarda.

## 🛠️ Stack

- **Frontend:** Vite + Preact (`@preact/signals`), Tailwind CSS (dark mode / glassmorphism).
- **Backend:** Hono + `@hono/node-server`, **sin base de datos** (la biblioteca vive en un JSON del servidor).
- **APIs de YouTube:** Data API v3 (datos/chequeos, vía proxy) + IFrame Player API (reproducción 100% client-side).

## 🧱 Arquitectura

```
youtube-player/
├── server/                 # Servidor Hono (sirve la web + la API)
│   ├── index.js            # Entry point (PORT desde .env)
│   ├── app.js              # Monta /api/auth, /api/library, /api/youtube + SPA
│   ├── config.js           # server/.config.json (config de la app, sin caché)
│   ├── auth.js             # scrypt + tokens HMAC de sesión
│   ├── sessions.js         # Registro de sesiones (server/data/sessions.json)
│   └── routes/
│       ├── auth.js         # /api/auth/* (status, unlock, verify, password, lock, settings)
│       ├── library.js      # /api/library (biblioteca multi-dispositivo)
│       └── youtube.js      # /api/youtube/* (proxy de la Data API, F3)
└── src/
    ├── api/                # youtubeApi, iframePlayer, linkChecker, playerEvents...
    ├── components/         # layout, player, playlist, settings
    ├── state/              # Signals: authState, modeState, settingsState, playlistState...
    └── storage/            # StorageAdapter + ServerStorageAdapter + InMemoryStorageAdapter
```

El **modo local fue eliminado**: la app **requiere su servidor**. La biblioteca vive en el servidor (`server/data/library.json`) y es la fuente de verdad multi-dispositivo; solo el modo demo (`/demo`) usa memoria.

## 🚀 Puesta en marcha

### Requisitos
- Node.js 20+

### Desarrollo (dos procesos)
```bash
npm install
npm run dev:server   # API + auth (Hono, puerto 3000)
npm run dev          # Frontend Vite (puerto 5173, proxy /api → 3000)
```
Abre http://localhost:5173

### Producción
```bash
npm run build        # Genera dist/
npm start            # El servidor sirve la web + la API en un solo proceso
```
Abre http://127.0.0.1:3000

## ⚙️ Configuración

### Entorno (`server/.env`)
Solo lo específico del despliegue. Copia `server/.env.example` a `server/.env`:

```
PORT=3000
```

### Configuración de la app (`server/.config.json`)
Se genera automáticamente al primer arranque (gitignored). El servidor lo relee en cada petición: **editarlo tiene efecto inmediato**.

| Clave | Descripción |
| --- | --- |
| `authSecret` | Secreto HMAC para firmar sesiones (auto-generado). |
| `masterPasswordHash` | Hash scrypt de la contraseña maestra (`null` = sin contraseña). |
| `noAuthentication` | `true` = instancia pública / modo recuperación. |
| `youtubeApiKey` | Tu YouTube Data API v3 key (se configura desde la UI, solo en el servidor). |
| `demoEnabled` | `false` = la ruta `/demo` deja de existir (decisión del super usuario). |

### API key de YouTube (F3)
1. Obtén una key en [Google Cloud Console](https://console.cloud.google.com/) habilitando *YouTube Data API v3*.
2. En la app: **Ajustes → API Key** → pégala y guárdala. El servidor la valida contra Google **antes** de persistirla en `server/.config.json`.
3. Nunca se guarda en `localStorage` ni viaja al frontend; la demo no puede tocarla.

### Contraseña maestra
- Desde la UI: **Ajustes de Usuario** → establecer/cambiar/eliminar contraseña, y "Bloquear ahora".
- Desde CLI (recuperación de acceso si se pierde):
  ```bash
  npm run password -- "nueva-clave"   # establece/cambia
  npm run password                    # elimina la protección (instancia abierta)
  ```
- La sesión dura **30 días** y se re-valida contra el servidor (revocación en caliente si la config cambia).
- Si `noAuthentication: true` (modo recuperación), la UI permite restablecer la contraseña sin sesión y la reactiva automáticamente.

## 🔌 API (resumen)

- `GET /api/auth/status` — contraseña, noAuthentication, `demoEnabled`.
- `POST /api/auth/unlock` — valida contraseña y entrega token de sesión.
- `GET /api/auth/verify` — confirma que la sesión sigue activa.
- `POST /api/auth/password` — establecer/cambiar/eliminar contraseña maestra.
- `POST /api/auth/lock` — revoca la sesión actual ("Bloquear ahora").
- `POST /api/auth/settings` — configuración de la instancia (hoy: `demoEnabled`).
- `GET/PUT/POST/DELETE /api/library` — biblioteca multi-dispositivo (PUT debounced por el cliente).
- `GET /api/youtube/status` — ¿hay key configurada?
- `POST/DELETE /api/youtube/key` — guardar/eliminar la key (validada contra Google).
- `GET /api/youtube/videos?ids=...` — chequeo de links (estado + metadata).
- `GET /api/youtube/playlist?listId=...` — import/sync con paginación.
- `GET /api/youtube/search?q=...` — búsqueda para el modal de reemplazo.

## 🧪 Tests

```bash
npm test            # Suite de lógica + servidor (node --test)
npm run test:e2e    # Tests de navegador (Playwright)
```

## 🧾 Aviso legal / Disclaimer (ToS)

> ⚠️ **Este proyecto NO está afiliado, respaldado ni patrocinado por Google o YouTube.**

- La **reproducción** usa la **YouTube IFrame Player API oficial** (embedding). El contenido se reproduce desde YouTube y **permanece en YouTube**: la app **no descarga, no re-sirve ni redistribuye** videos ni audio. Está prohibido extraer o almacenar el contenido audiovisual.
- El uso de la **YouTube Data API v3** requiere una key propia y está sujeto a los **Términos del Servicio de YouTube** y a los **Términos del Servicio de la API de Google / API de Servicios de YouTube**, incluidas las **Developer Policies**:
  - La metadata de la API (miniatura, fecha de publicación, duración) se refresca y **no se retiene más de 30 días**; los datos de usuario (título/artista editables) y el `videoId` como enlace al recurso se conservan.
  - El chequeo de enlaces y la importación consumen cuota de tu API key: el barrido es deliberadamente lento (1 lote de 50 IDs por minuto) para respetar las cuotas gratuitas.
- **Responsabilidad del usuario:** respeta los Términos del Servicio de YouTube, los derechos de autor y las restricciones que los propietarios de contenido impongan. Este proyecto **no evade** DRM, bloqueos de región, autenticación ni restricciones de acceso: los videos con embed bloqueado, privados o restringidos se **detectan y se marcan**, nunca se fuerzan.
- La "copia reproducible" es una **decisión manual del usuario**: encontrar un video alternativo legítimo (p.ej. otra subida oficial) y enlazarlo a su entrada. No se trata de copiar ni de evadir ninguna restricción.
- Este software se distribuye **sin garantía** (ver [LICENSE](LICENSE)).

## 📄 Licencia

[MIT](LICENSE)
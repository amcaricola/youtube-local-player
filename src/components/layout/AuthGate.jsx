import { useEffect } from 'preact/hooks';
import { authState, initAuth, reverify } from '../../state/authState.js';
import { modeState } from '../../state/modeState.js';
import { SplashScreen } from './SplashScreen.jsx';
import { LockScreen } from './LockScreen.jsx';
import { ServerUnreachableScreen } from './ServerUnreachableScreen.jsx';

const REVERIFY_INTERVAL_MS = 15000;

/**
 * Envoltorio de seguridad de la aplicación. Se resuelve la autenticación
 * ANTES de montar cualquier contenido: mientras se consulta /api/auth/status
 * se muestra un SplashScreen y ninguna llamada a la API de YouTube ni a la
 * biblioteca (que es privada y exige el token otorgado por el servidor) se
 * realiza hasta que la sesión esté confirmada.
 *
 * - Sesión privada (el servidor tiene contraseña) sin sesión válida → LockScreen.
 * - Sin contraseña (versión abierta) o ya autenticado → se monta el contenido.
 * - Servidor inalcanzable → ServerUnreachableScreen (la app no funciona local).
 * - La demo (/demo) queda libre: no se bloquea ni exige sesión.
 *
 * Además re-verifica la sesión periódicamente (y al recuperar el foco): si el
 * servidor exige contraseña y la sesión presentada deja de ser válida, se
 * vuelve al LockScreen sin recargar. Si el modo cambia (p.ej. el super usuario
 * deshabilita la demo estando en /demo) se rearma el intervalo.
 */
export function AuthGate({ children }) {
  useEffect(() => {
    initAuth();
    if (modeState.isDemo.value) return;
    const check = () => reverify();
    const timer = setInterval(check, REVERIFY_INTERVAL_MS);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [modeState.isDemo.value]);

  if (!authState.ready.value) {
    return <SplashScreen />;
  }

  if (authState.serverUnreachable.value) {
    return <ServerUnreachableScreen />;
  }

  const locked = !modeState.isDemo.value && authState.passwordRequired.value && authState.isLocked.value;
  if (locked) {
    return <LockScreen />;
  }

  return children;
}
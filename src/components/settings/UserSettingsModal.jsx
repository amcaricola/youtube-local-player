import { useState } from 'preact/hooks';
import { settingsState } from '../../state/settingsState.js';
import { modeState } from '../../state/modeState.js';
import { authState, setMasterPassword, lockNow } from '../../state/authState.js';
import { showToast } from '../../state/playlistState.js';

export function UserSettingsModal() {
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState(null);

  const handleClose = () => {
    settingsState.isUserSettingsOpen.value = false;
    setPwNew('');
    setPwConfirm('');
    setPwMsg(null);
  };

  const handleSetPassword = () => {
    if (pwNew.length < 4) {
      setPwMsg({ type: 'error', msg: 'La contraseña debe tener al menos 4 caracteres.' });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ type: 'error', msg: 'Las contraseñas no coinciden.' });
      return;
    }
    setMasterPassword(pwNew);
    setPwNew('');
    setPwConfirm('');
    setPwMsg({ type: 'success', msg: 'Contraseña maestra guardada.' });
  };

  const handleRemovePassword = () => {
    setMasterPassword('');
    setPwNew('');
    setPwConfirm('');
    setPwMsg({ type: 'success', msg: 'Contraseña maestra eliminada.' });
  };

  const handleLockNow = () => {
    lockNow();
    settingsState.isUserSettingsOpen.value = false;
    showToast('Instancia bloqueada');
  };

  if (!settingsState.isUserSettingsOpen.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 class="text-2xl font-bold mb-2">Ajustes de Usuario</h2>
            <p class="text-sm text-gray-400">Contraseña maestra y versión demo.</p>
          </div>
          <button
            onClick={handleClose}
            class="shrink-0 text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar ajustes de usuario"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-300 mb-3">Acceso de Super Usuario</h3>
            {!authState.passwordRequired.value ? (
              <>
                <p class="text-xs text-gray-400 mb-3">Protege la versión servidor con una contraseña maestra. La sesión dura 30 días y luego se vuelve a pedir (por seguridad).</p>
                <input
                  type="password"
                  value={pwNew}
                  onInput={(e) => setPwNew(e.target.value)}
                  placeholder="Nueva contraseña maestra"
                  class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors mb-2"
                />
                <input
                  type="password"
                  value={pwConfirm}
                  onInput={(e) => setPwConfirm(e.target.value)}
                  placeholder="Confirmar contraseña"
                  class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors mb-2"
                />
                <button
                  onClick={handleSetPassword}
                  disabled={!pwNew || pwNew !== pwConfirm}
                  class="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold transition-all disabled:opacity-50 text-white"
                >
                  Establecer contraseña maestra
                </button>
              </>
            ) : (
              <>
                <p class="text-xs text-gray-400 mb-3">Contraseña maestra activa. La sesión dura 30 días; cierra sesión cuando quieras.</p>
                <input
                  type="password"
                  value={pwNew}
                  onInput={(e) => setPwNew(e.target.value)}
                  placeholder="Nueva contraseña maestra"
                  class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors mb-2"
                />
                <input
                  type="password"
                  value={pwConfirm}
                  onInput={(e) => setPwConfirm(e.target.value)}
                  placeholder="Confirmar nueva contraseña"
                  class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors mb-2"
                />
                <div class="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSetPassword}
                    disabled={!pwNew || pwNew !== pwConfirm}
                    class="py-2.5 bg-purple-600/80 hover:bg-purple-500 rounded-lg font-semibold transition-all disabled:opacity-50 text-white text-sm"
                  >
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={handleRemovePassword}
                    class="py-2.5 bg-transparent hover:bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    Eliminar contraseña
                  </button>
                </div>
                {!modeState.isDemo.value && (
                  <button
                    onClick={handleLockNow}
                    class="w-full mt-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-200 transition-colors"
                  >
                    Bloquear ahora (cerrar sesión)
                  </button>
                )}
              </>
            )}
            {pwMsg && (
              <div class={`text-sm p-3 mt-3 rounded-lg ${
                pwMsg.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
              }`}>
                {pwMsg.msg}
              </div>
            )}
          </div>

          {!modeState.isDemo.value && (
            <div class="border-t border-white/10 pt-4">
              <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <div class="text-sm font-medium text-gray-200">Habilitar versión demo</div>
                  <div class="text-xs text-gray-400">Si la desactivas, la ruta /demo deja de existir y solo se accede con contraseña</div>
                </div>
                <button
                  onClick={() => settingsState.demoEnabled.value = !settingsState.demoEnabled.value}
                  class={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${settingsState.demoEnabled.value ? 'bg-blue-600' : 'bg-gray-700'}`}
                  title={settingsState.demoEnabled.value ? 'Activado' : 'Desactivado'}
                >
                  <span class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settingsState.demoEnabled.value ? 'left-[22px]' : 'left-0.5'}`}></span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
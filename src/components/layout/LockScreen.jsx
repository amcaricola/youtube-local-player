import { useState } from 'preact/hooks';
import { unlockWithPassword } from '../../state/authState.js';
import { settingsState } from '../../state/settingsState.js';

export function LockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setError('');
    if (!password) return;
    setLoading(true);
    try {
      const ok = await unlockWithPassword(password);
      if (!ok) {
        setError('Contraseña incorrecta o servidor inalcanzable.');
        setPassword('');
      }
    } catch {
      setError('No se pudo contactar con el servidor.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="h-screen w-full flex items-center justify-center bg-gray-900 p-4">
      <div class="glass-dark w-full max-w-sm rounded-2xl p-8 border border-white/10 text-center">
        <div class="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-400/30 flex items-center justify-center mx-auto mb-4 text-purple-300">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <h2 class="text-xl font-bold mb-1">Bienvenido</h2>
        <p class="text-sm text-gray-400 mb-6">
          Ingresa tu contraseña para continuar.
        </p>
        <input
          type="password"
          value={password}
          onInput={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleUnlock(); }}
          placeholder="Contraseña"
          autoFocus
          class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
        />
        <button
          onClick={handleUnlock}
          disabled={loading || !password}
          class="w-full mt-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold transition-all disabled:opacity-50"
        >
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
        {error && (
          <div class="text-sm p-3 mt-3 rounded-lg bg-red-500/20 text-red-300">{error}</div>
        )}
        {settingsState.demoEnabled.value && (
          <button
            onClick={() => { location.href = './demo'; }}
            class="mt-4 w-full py-2.5 bg-white/5 hover:bg-purple-500/15 border border-purple-400/30 rounded-lg text-sm font-medium text-purple-300 hover:text-purple-200 transition-colors"
          >
            Ver versión demo
          </button>
        )}
      </div>
    </div>
  );
}
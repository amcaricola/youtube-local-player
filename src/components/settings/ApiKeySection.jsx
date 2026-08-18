import { useEffect, useState } from 'preact/hooks';
import { settingsState, refreshKeyStatus } from '../../state/settingsState.js';
import { saveKeyToServer, removeServerKey } from '../../api/youtubeApi.js';
import { modeState } from '../../state/modeState.js';

/** Configuración de la YouTube Data API v3 key EN EL SERVIDOR (F3). */
export function ApiKeySection({ onClose }) {
  const [inputKey, setInputKey] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshKeyStatus();
  }, []);

  if (modeState.isDemo.value) return null;

  const handleSave = async () => {
    if (!inputKey.trim()) {
      setStatus({ type: 'error', msg: 'La API Key no puede estar vacía' });
      return;
    }
    setLoading(true);
    setStatus({ type: 'info', msg: 'Validando y guardando en el servidor...' });
    try {
      await saveKeyToServer(inputKey.trim());
      setInputKey('');
      setStatus({ type: 'success', msg: 'API Key guardada en el servidor. Ya puedes importar y verificar links.' });
      refreshKeyStatus();
    } catch (e) {
      setStatus({ type: 'error', msg: e.message || 'No se pudo guardar la API Key.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setStatus({ type: 'info', msg: 'Eliminando...' });
    try {
      await removeServerKey();
      setStatus({ type: 'success', msg: 'API Key eliminada del servidor.' });
      refreshKeyStatus();
    } catch (e) {
      setStatus({ type: 'error', msg: e.message || 'No se pudo eliminar la API Key.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">YouTube Data API v3 Key</label>
        {settingsState.hasServerKey.value ? (
          <div class="text-sm p-3 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 flex items-center justify-between gap-3">
            <span>El servidor tiene una API Key configurada.</span>
            <button
              onClick={handleRemove}
              disabled={loading}
              class="shrink-0 px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>
        ) : (
          <div class="text-sm p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-3">
            No hay API Key configurada en el servidor. Sin ella no se pueden importar playlists, verificar links ni buscar reemplazos.
          </div>
        )}

        <input
          type="password"
          value={inputKey}
          onInput={(e) => { setInputKey(e.target.value); setStatus({ type: '', msg: '' }); }}
          class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="AIzaSy..."
        />
        <p class="text-xs text-gray-500 mt-2">
          La key se valida y guarda en el servidor (server/.config.json); nunca se almacena en tu navegador.
          El servidor la usa para todas las llamadas a la API de YouTube.
        </p>
      </div>

      {status.msg && (
        <div class={`text-sm p-3 mt-3 rounded-lg ${
          status.type === 'error' ? 'bg-red-500/20 text-red-300' :
          status.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
        }`}>
          {status.msg}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={loading || !inputKey.trim()}
        class="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-all disabled:opacity-50 mt-4"
      >
        {loading ? 'Guardando...' : settingsState.hasServerKey.value ? 'Cambiar API Key' : 'Guardar API Key en el servidor'}
      </button>
    </>
  );
}
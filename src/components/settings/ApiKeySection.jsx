import { useState } from 'preact/hooks';
import { settingsState } from '../../state/settingsState.js';
import { checkApiKey } from '../../api/youtubeApi.js';

/** Validación y guardado de la YouTube Data API v3 Key. */
export function ApiKeySection({ onClose }) {
  const [inputKey, setInputKey] = useState(settingsState.apiKey.value);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const handleValidate = async () => {
    if (!inputKey.trim()) {
      setStatus({ type: 'error', msg: 'La API Key no puede estar vacía' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', msg: 'Validando API Key en Google Servers...' });

    const isValid = await checkApiKey(inputKey.trim());
    setLoading(false);

    if (isValid) {
      setIsValidated(true);
      setStatus({ type: 'success', msg: '¡Llave válida! Ahora puedes guardarla.' });
    } else {
      setIsValidated(false);
      setStatus({ type: 'error', msg: 'La API Key es inválida o no tiene permisos de YouTube Data API v3.' });
    }
  };

  const handleSave = () => {
    settingsState.apiKey.value = inputKey.trim();
    setStatus({ type: 'success', msg: 'Guardado correctamente.' });
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <>
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">YouTube Data API v3 Key</label>
        <input
          type="password"
          value={inputKey}
          onInput={(e) => {
            setInputKey(e.target.value);
            setIsValidated(false);
          }}
          class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="AIzaSy..."
        />
      </div>

      {status.msg && (
        <div class={`text-sm p-3 rounded-lg ${
          status.type === 'error' ? 'bg-red-500/20 text-red-300' :
          status.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
        }`}>
          {status.msg}
        </div>
      )}

      {!isValidated ? (
        <button
          onClick={handleValidate}
          disabled={loading || !inputKey.trim()}
          class="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-all disabled:opacity-50 mt-4"
        >
          {loading ? 'Validando...' : 'Validar API Key'}
        </button>
      ) : (
        <button
          onClick={handleSave}
          class="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-semibold transition-all mt-4 text-white"
        >
          Guardar
        </button>
      )}
    </>
  );
}
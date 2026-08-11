import { useState } from 'preact/hooks';
import { settingsState } from '../../state/settingsState.js';
import { checkApiKey } from '../../api/youtubeApi.js';

export function SettingsModal() {
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
      handleClose();
    }, 1000);
  };

  const handleClose = () => {
    settingsState.isSettingsOpen.value = false;
    setInputKey(settingsState.apiKey.value);
    setStatus({ type: '', msg: '' });
    setIsValidated(false);
  };

  if (!settingsState.isSettingsOpen.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <button 
          onClick={handleClose}
          class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h2 class="text-2xl font-bold mb-2">Ajustes del Reproductor</h2>
        <p class="text-sm text-gray-400 mb-6">Configura tus credenciales para la API Oficial de YouTube.</p>
        
        <div class="space-y-4">
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
        </div>
      </div>
    </div>
  );
}

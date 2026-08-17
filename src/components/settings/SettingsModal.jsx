import { useEffect, useRef, useState } from 'preact/hooks';
import { settingsState } from '../../state/settingsState.js';
import { modeState, setMode } from '../../state/modeState.js';
import { checkApiKey } from '../../api/youtubeApi.js';
import { playlistState, showToast, loadLocalPlaylists } from '../../state/playlistState.js';
import { playerState } from '../../state/playerState.js';
import storage from '../../storage/index.js';

export function SettingsModal() {
  const [inputKey, setInputKey] = useState(settingsState.apiKey.value);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const [isValidated, setIsValidated] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 5 * 1024 * 1024 });
  const importInputRef = useRef(null);

  useEffect(() => {
    setConfirmWipe(false);
    setShowStatusDetails(false);
    if (settingsState.isSettingsOpen.value) {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += key.length + (localStorage.getItem(key) || '').length;
      }
      setStorageUsage({ used: total * 2, limit: 5 * 1024 * 1024 });
    }
  }, [settingsState.isSettingsOpen.value]);

  // Borrado total de datos locales a petición del usuario (Developer Policies III.E.4.g).
  const handleWipeAll = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    setConfirmWipe(false);
    await storage.clearAll();
    settingsState.apiKey.value = '';
    setMode('none');
    playerState.currentTrack.value = null;
    playlistState.playlists.value = [];
    playlistState.activePlaylist.value = null;
    showToast('Se eliminaron todos los datos locales');
    handleClose();
  };

  const handleExport = async () => {
    try {
      const jsonData = await storage.exportData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `youtube-player-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Respaldo exportado correctamente');
    } catch (error) {
      console.error('Error al exportar el respaldo:', error);
      setStatus({ type: 'error', msg: 'No se pudo exportar el respaldo.' });
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await storage.importData(await file.text());
      await loadLocalPlaylists();
      playlistState.activePlaylist.value = playlistState.playlists.value[0] || null;
      showToast('Respaldo importado correctamente');
      setStatus({ type: 'success', msg: 'Datos restaurados correctamente.' });
    } catch (error) {
      console.error('Error al importar el respaldo:', error);
      setStatus({ type: 'error', msg: 'El archivo no es un respaldo válido.' });
    } finally {
      event.target.value = '';
    }
  };

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
    setConfirmWipe(false);
    setShowStatusDetails(false);
  };

  const storagePercent = Math.min(100, Math.round((storageUsage.used / storageUsage.limit) * 100));

  if (!settingsState.isSettingsOpen.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div class="glass-dark w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl p-6 shadow-2xl relative border border-white/10">
        <div class="sticky -top-6 z-10 -mx-6 px-6 pt-1 pb-4 bg-slate-900/95 backdrop-blur-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold mb-2">Ajustes del Reproductor</h2>
              <p class="text-sm text-gray-400">Configura tus credenciales para la API Oficial de YouTube.</p>
            </div>
            <button
              onClick={handleClose}
              class="shrink-0 text-gray-400 hover:text-white transition-colors"
              aria-label="Cerrar ajustes"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
        
        <div class="space-y-4">
          <div class="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowStatusDetails(!showStatusDetails)}
              class="w-full flex items-center justify-between gap-2 py-2.5 px-3 text-left text-sm font-medium text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              aria-expanded={showStatusDetails}
            >
              <span>Detalles de los estados</span>
              <svg class={`w-4 h-4 transition-transform ${showStatusDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {showStatusDetails && <div class="space-y-2.5 text-xs text-gray-300 mt-3">
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-gray-400/70 mt-0.5 shrink-0"></span>
                <div>
                  <span class="font-medium text-gray-100">Sin verificar (gris)</span>
                  <p class="text-gray-400">Aún no se ha comprobado su disponibilidad. El checker lo revisa en su barrido automático (1 lote de 50 videos por minuto).</p>
                </div>
              </div>
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-green-400 mt-0.5 shrink-0"></span>
                <div>
                  <span class="font-medium text-gray-100">OK (verde)</span>
                  <p class="text-gray-400">El video existe y permite reproducción embebida.</p>
                </div>
              </div>
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 mt-0.5 shrink-0"></span>
                <div>
                  <span class="font-medium text-gray-100">Aviso (ámbar)</span>
                  <p class="text-gray-400">Video privado o con reproducción embebida bloqueada por el propietario: puede fallar al reproducirse (aunque el video exista en YouTube).</p>
                </div>
              </div>
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-400 mt-0.5 shrink-0"></span>
                <div>
                  <span class="font-medium text-gray-100">Roto (rojo)</span>
                  <p class="text-gray-400">Video eliminado o no disponible; no se puede reproducir. Clic en el badge abre la búsqueda de un reemplazo sin perder tus metadatos. Tienes un plazo de días (visible en el badge) para repararlo antes de que se elimine la metadata de YouTube; tu título y artista siempre se conservan.</p>
                </div>
              </div>
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-violet-400 mt-0.5 shrink-0"></span>
                <div>
                  <span class="font-medium text-gray-100">Fuera de la playlist (violeta)</span>
                  <p class="text-gray-400">La canción ya no está en la playlist de YouTube, pero sigue guardada localmente con su información para poder recuperarla.</p>
                </div>
              </div>
              <p class="text-gray-500 pt-1">Pasa el mouse sobre un badge en la lista para ver el motivo exacto de cada canción.</p>
            </div>}
          </div>

          <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
            <div>
              <div class="text-sm font-medium text-gray-200">Sincronizar playlists al iniciar</div>
              <div class="text-xs text-gray-400">Detecta canciones nuevas y eliminadas de cada playlist de YouTube</div>
              {modeState.isDemo.value && (
                <div class="text-xs text-amber-300/80 mt-1">No disponible en versión demo</div>
              )}
            </div>
            <button
              onClick={() => settingsState.autoSyncPlaylists.value = !settingsState.autoSyncPlaylists.value}
              disabled={modeState.isDemo.value}
              class={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${settingsState.autoSyncPlaylists.value ? 'bg-blue-600' : 'bg-gray-700'} ${modeState.isDemo.value ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={settingsState.autoSyncPlaylists.value ? 'Activado' : 'Desactivado'}
            >
              <span class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settingsState.autoSyncPlaylists.value ? 'left-[22px]' : 'left-0.5'}`}></span>
            </button>
          </div>

          <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
            <div>
              <div class="text-sm font-medium text-gray-200">Verificación automática de links</div>
              <div class="text-xs text-gray-400">Revisa en segundo plano si los videos siguen disponibles</div>
              {modeState.isDemo.value && (
                <div class="text-xs text-amber-300/80 mt-1">No disponible en versión demo</div>
              )}
            </div>
            <button
              onClick={() => settingsState.autoCheckLinks.value = !settingsState.autoCheckLinks.value}
              disabled={modeState.isDemo.value}
              class={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${settingsState.autoCheckLinks.value ? 'bg-blue-600' : 'bg-gray-700'} ${modeState.isDemo.value ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={settingsState.autoCheckLinks.value ? 'Activado' : 'Desactivado'}
            >
              <span class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settingsState.autoCheckLinks.value ? 'left-[22px]' : 'left-0.5'}`}></span>
            </button>
          </div>

          <div class="border-t border-white/10 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-300">Almacenamiento Local</h3>
              <span class="text-xs text-gray-400">
                {(storageUsage.used / (1024 * 1024)).toFixed(1)} MB / {(storageUsage.limit / (1024 * 1024)).toFixed(0)} MB
              </span>
            </div>
            <div class="h-2 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                class={`h-full rounded-full transition-all ${
                  storagePercent >= 90 ? 'bg-red-500' : storagePercent >= 70 ? 'bg-amber-400' : 'bg-green-500'
                }`}
                style={{ width: `${storagePercent}%` }}
              ></div>
            </div>
            <p class="text-xs text-gray-400 mt-2">{storagePercent}% usado de la capacidad habitual del navegador.</p>
            <p class="text-xs text-gray-500 mt-2">
              Los títulos y artistas son editables y pueden diferir del video de YouTube. La fecha de publicación,
              miniatura y duración provienen de la API de YouTube y se renuevan automáticamente (máx. 30 días);
              si un link roto no se repara a tiempo, esa metadata se elimina y conservas tu título y artista.
            </p>
            {storagePercent >= 90 && (
              <p class="text-xs text-red-300 mt-1">
                El almacenamiento está casi lleno. Considera exportar un respaldo o eliminar playlists para liberar espacio.
              </p>
            )}
            <div class="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={handleExport}
                class="py-2 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-200 hover:bg-blue-500/30 transition-colors text-sm font-medium"
              >
                Exportar JSON
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                class="py-2 rounded-lg bg-purple-500/15 border border-purple-400/30 text-purple-200 hover:bg-purple-500/30 transition-colors text-sm font-medium"
              >
                Importar JSON
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImport}
                class="hidden"
              />
            </div>
            <button
              onClick={handleWipeAll}
              class={`w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors border ${
                confirmWipe
                  ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
                  : 'bg-transparent hover:bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              {confirmWipe ? '¿Confirmar? Se borrarán TODAS las playlists y metadatos locales' : 'Borrar todos mis datos'}
            </button>
          </div>

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

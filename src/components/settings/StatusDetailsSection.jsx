import { useState } from 'preact/hooks';

/** Panel colapsable que explica cada badge de estado del link checker. */
export function StatusDetailsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div class="border-t border-white/10 pt-4">
      <button
        onClick={() => setOpen(!open)}
        class="w-full flex items-center justify-between gap-2 py-2.5 px-3 text-left text-sm font-medium text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
        aria-expanded={open}
      >
        <span>Detalles de los estados</span>
        <svg class={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {open && (
        <div class="space-y-2.5 text-xs text-gray-300 mt-3">
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
        </div>
      )}
    </div>
  );
}
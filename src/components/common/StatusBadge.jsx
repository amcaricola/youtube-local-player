const DOT_STYLES = {
  healthy: 'bg-green-500/20 border-green-500/40 text-green-400',
  warning: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  broken: 'bg-red-500/20 border-red-500/40 text-red-400',
  unchecked: 'bg-gray-500/20 border-gray-500/40 text-gray-400',
  removed: 'bg-violet-500/20 border-violet-500/40 text-violet-400'
};

const LABELS = {
  healthy: 'Link activo',
  warning: 'Aviso',
  broken: 'Link roto',
  unchecked: 'Sin verificar',
  removed: 'Fuera de la playlist de YouTube'
};

function Icon({ status }) {
  if (status === 'healthy') {
    return <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;
  }
  if (status === 'warning') {
    return <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>;
  }
  if (status === 'broken') {
    return <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>;
  }
  if (status === 'removed') {
    return <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h.39A1.5 1.5 0 017.76 4.5h4.48A1.5 1.5 0 0113.61 3H14a3 3 0 013 3v9a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm3-1a1 1 0 011-1h.39a.5.5 0 01.47.35l.05.15h4.18l.05-.15A.5.5 0 0113.61 5H14a1 1 0 011 1v.25H4V6a1 1 0 011-1zM4 9.5V15a1 1 0 001 1h10a1 1 0 001-1V9.5H4z" clipRule="evenodd"></path></svg>;
  }
  return <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"></path></svg>;
}

export function StatusBadge({ status = 'unchecked', message = '', recoveryDaysLeft = null, onClick }) {
  const canRepair = status === 'broken' || status === 'warning' || status === 'removed';
  return (
    <span class="relative inline-flex group/badge align-middle">
      <button
        onClick={(e) => { e.stopPropagation(); if (onClick && canRepair) onClick(); }}
        disabled={!canRepair || !onClick}
        class={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${DOT_STYLES[status] || DOT_STYLES.unchecked} ${canRepair && onClick ? 'cursor-pointer hover:ring-2 hover:ring-white/30' : 'cursor-default'}`}
      >
        <Icon status={status} />
      </button>
      <div class="absolute bottom-full mb-2 right-0 z-50 px-3 py-2 rounded-lg bg-gray-900/95 border border-white/10 text-xs whitespace-normal max-w-[280px] text-left opacity-0 pointer-events-none group-hover/badge:opacity-100 transition-opacity shadow-2xl">
        <div class="font-semibold text-gray-100">{LABELS[status] || 'Sin verificar'}</div>
        {message && <div class="text-gray-300">{message}</div>}
        {status === 'broken' && recoveryDaysLeft !== null && (
          recoveryDaysLeft > 0 ? (
            <div class="text-amber-300">
              Repara antes de {recoveryDaysLeft}d: después se elimina la metadata de YouTube (fecha, miniatura, duración). Tu título y artista se conservan.
            </div>
          ) : (
            <div class="text-gray-400">
              Metadata de YouTube eliminada por antigüedad. Conservas tu título y artista para repararla.
            </div>
          )
        )}
        {canRepair && <div class="text-blue-400">{status === 'removed' ? 'Clic para abrir en YouTube' : 'Clic para buscar reemplazo'}</div>}
      </div>
    </span>
  );
}
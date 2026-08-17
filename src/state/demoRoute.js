/**
 * Detección de la ruta demo por pathname (último segmento == 'demo').
 * Sin dependencias: lo usan `modeState` (modo) y `settingsState` (aislamiento
 * de configuración en la demo) sin generar ciclos de imports.
 */
export const isDemoRoute = () => {
  if (typeof location === 'undefined') return false;
  const segments = location.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] === 'demo';
};
/**
 * Pantalla de carga mostrada mientras AuthGate resuelve la autenticación
 * (consulta /api/auth/status). Antes de esto NO se monta ningún contenido.
 */
export function SplashScreen() {
  return (
    <div class="h-screen w-full flex items-center justify-center bg-gray-900">
      <div class="text-center">
        <div class="relative w-16 h-16 mx-auto mb-5">
          <div class="absolute inset-0 rounded-full bg-purple-600/10 animate-ping"></div>
          <div class="relative w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
        </div>
        <p class="text-sm text-gray-400">Verificando seguridad...</p>
      </div>
    </div>
  );
}
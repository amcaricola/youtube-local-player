export function ServerUnreachableScreen() {
  return (
    <div class="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div class="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-400/30 flex items-center justify-center mb-2 text-red-400">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      </div>
      <h2 class="text-2xl font-bold">No se pudo conectar con el servidor</h2>
      <p class="text-gray-400 max-w-md text-sm">
        Esta versión necesita su servidor para funcionar (la biblioteca y la autenticación viven en él).
        Asegúrate de que la instancia esté arrancada (<code class="text-gray-300">npm start</code> o <code class="text-gray-300">npm run dev:server</code>)
        y recarga la página.
      </p>
      <button
        onClick={() => location.reload()}
        class="mt-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold transition-all"
      >
        Reintentar
      </button>
    </div>
  );
}
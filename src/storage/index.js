import { signal, effect } from '@preact/signals';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter.js';
import { ServerStorageAdapter } from './ServerStorageAdapter.js';
import { modeState } from '../state/modeState.js';

// El modo local ya no existe: la biblioteca siempre vive en el servidor
// (/api/library). Solo la demo (ruta /demo) usa memoria (nada se persiste).
const memoryAdapter = new InMemoryStorageAdapter();
const serverAdapter = new ServerStorageAdapter();

const activeStorage = signal(serverAdapter);

effect(() => {
  if (modeState.isDemo.value) {
    activeStorage.value = memoryAdapter;
  } else {
    activeStorage.value = serverAdapter;
  }
});

// Fachada: delega cada método al adaptador activo.
const storage = new Proxy({}, {
  get(_, prop) {
    const adapter = activeStorage.value;
    const value = adapter[prop];
    return typeof value === 'function' ? value.bind(adapter) : value;
  }
});

export default storage;